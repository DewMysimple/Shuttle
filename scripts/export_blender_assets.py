import json
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


def parse_arguments():
    if "--" not in sys.argv:
        raise SystemExit(
            "Usage: blender -b input.blend --python export_blender_assets.py -- output_dir [alembic_cache]"
        )

    separator = sys.argv.index("--")
    arguments = sys.argv[separator + 1 :]
    if not arguments:
        raise SystemExit("Missing output directory")

    output_directory = Path(arguments[0]).resolve()
    cache_path = Path(arguments[1]).resolve() if len(arguments) > 1 else None
    return output_directory, cache_path


def select_objects(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def configure_mesh_cache(model, supplied_cache_path):
    cache_modifier = next(
        (modifier for modifier in model.modifiers if modifier.type == "MESH_SEQUENCE_CACHE"),
        None,
    )
    if cache_modifier is None or cache_modifier.cache_file is None:
        return None

    cache_path = supplied_cache_path or Path(bpy.path.abspath(cache_modifier.cache_file.filepath))
    if not cache_path.exists():
        raise RuntimeError(
            "The orchid animation cache is missing. Provide the .abc path as the second export argument: "
            f"{cache_path}"
        )

    cache_modifier.cache_file.filepath = str(cache_path)
    return cache_path


def sample_frames(scene):
    start_frame = scene.frame_start
    end_frame = scene.frame_end
    return list(range(start_frame, end_frame + 1))


def evaluated_mesh(source, depsgraph):
    evaluated = source.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
    return evaluated, mesh


def copy_material_slots(source, target):
    for slot in source.material_slots:
        if slot.material:
            target.data.materials.append(slot.material)


def bake_mesh_sequence(scene, source, frames):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    scene.frame_set(frames[0])
    bpy.context.view_layer.update()

    evaluated = source.evaluated_get(depsgraph)
    baked_mesh = bpy.data.meshes.new_from_object(
        evaluated,
        depsgraph=depsgraph,
        preserve_all_data_layers=True,
    )
    baked_model = bpy.data.objects.new("兰花_时间切片模型", baked_mesh)
    bpy.context.scene.collection.objects.link(baked_model)
    baked_model.matrix_world = source.matrix_world.copy()
    copy_material_slots(source, baked_model)

    basis = baked_model.shape_key_add(name="Basis")
    if len(basis.data) == 0:
        raise RuntimeError("The orchid mesh has no vertices after evaluating its Alembic cache")

    shape_key_blocks = []
    for index, frame in enumerate(frames):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated, sampled_mesh = evaluated_mesh(source, depsgraph)
        try:
            if len(sampled_mesh.vertices) != len(basis.data):
                raise RuntimeError(
                    f"Orchid vertex count changed at frame {frame}: "
                    f"expected {len(basis.data)}, got {len(sampled_mesh.vertices)}"
                )

            shape_key = baked_model.shape_key_add(name=f"Frame_{index + 1:03d}")
            for target_vertex, source_vertex in zip(shape_key.data, sampled_mesh.vertices):
                target_vertex.co = source_vertex.co
            shape_key_blocks.append(shape_key)
        finally:
            evaluated.to_mesh_clear()

    create_shape_key_animation(baked_model, shape_key_blocks, frames)
    return baked_model


def create_shape_key_animation(model, shape_key_blocks, frames):
    shape_keys = model.data.shape_keys
    action = bpy.data.actions.new("Orchid_Time_Slices")
    shape_keys.animation_data_create()
    shape_keys.animation_data.action = action

    for index, shape_key in enumerate(shape_key_blocks):
        fcurve = action.fcurve_ensure_for_datablock(
            shape_keys,
            f'key_blocks["{shape_key.name}"].value',
        )

        if index == 0:
            key_points = [(frames[0], 1.0), (frames[1], 0.0)]
        elif index == len(shape_key_blocks) - 1:
            key_points = [(frames[-2], 0.0), (frames[-1], 1.0)]
        else:
            key_points = [
                (frames[index - 1], 0.0),
                (frames[index], 1.0),
                (frames[index + 1], 0.0),
            ]

        for frame, value in key_points:
            point = fcurve.keyframe_points.insert(frame, value)
            point.interpolation = "LINEAR"

    for shape_key in shape_key_blocks:
        shape_key.value = 0.0
    shape_key_blocks[0].value = 1.0


def export_glb(output_path, model):
    select_objects([model])
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=False,
        export_morph=True,
        export_materials="EXPORT",
        export_apply=True,
    )


def projected_bounds(scene, camera, world_points):
    projections = [world_to_camera_view(scene, camera, point) for point in world_points]
    return (
        min(point.x for point in projections),
        min(point.y for point in projections),
        max(point.x for point in projections),
        max(point.y for point in projections),
    )


def fit_camera_to_animation(scene, model, frames, margin=0.08):
    """Fit one stable camera view around every evaluated animation pose.

    The source camera is composed for the early, closed pose. The flower grows
    beyond that framing later in the cache, so rendering without a global fit
    cuts the last poses at the edge of each PNG. We keep the original camera
    orientation, widen the lens just enough for the union of all poses, and
    calibrate camera shift so that the union is optically centered.
    """
    camera = scene.camera
    if camera is None:
        return None

    original_camera = {
        "lens": camera.data.lens,
        "shift_x": camera.data.shift_x,
        "shift_y": camera.data.shift_y,
    }
    original_frame = scene.frame_current
    depsgraph = bpy.context.evaluated_depsgraph_get()
    world_points = []

    for frame in frames:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated = model.evaluated_get(depsgraph)
        world_points.extend(
            evaluated.matrix_world @ Vector(corner)
            for corner in evaluated.bound_box
        )

    if not world_points:
        scene.frame_set(original_frame)
        return original_camera

    base_bounds = projected_bounds(scene, camera, world_points)
    base_width = base_bounds[2] - base_bounds[0]
    base_height = base_bounds[3] - base_bounds[1]
    available_size = max(1 - margin * 2, 0.5)
    fit_scale = max(base_width / available_size, base_height / available_size, 1)

    camera.data.lens = original_camera["lens"] / fit_scale
    camera.data.shift_x = 0
    camera.data.shift_y = 0

    def current_center():
        bounds = projected_bounds(scene, camera, world_points)
        return ((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2)

    def center_axis(axis):
        center = current_center()
        current_value = getattr(camera.data, axis)
        probe_value = current_value + 0.01
        setattr(camera.data, axis, probe_value)
        probe_center = current_center()
        slope = (probe_center[0 if axis == "shift_x" else 1] - center[0 if axis == "shift_x" else 1]) / 0.01
        setattr(camera.data, axis, current_value)
        if abs(slope) > 1e-6:
            target_value = current_value + (0.5 - center[0 if axis == "shift_x" else 1]) / slope
            setattr(camera.data, axis, target_value)

    center_axis("shift_x")
    center_axis("shift_y")
    final_bounds = projected_bounds(scene, camera, world_points)
    print(
        "Camera fit: "
        f"lens={camera.data.lens:.3f}, "
        f"shift=({camera.data.shift_x:.4f}, {camera.data.shift_y:.4f}), "
        f"projected_bounds={tuple(round(value, 4) for value in final_bounds)}"
    )
    scene.frame_set(original_frame)
    return original_camera


def render_slices(output_directory, scene, model, frames):
    slice_directory = output_directory / "slices"
    slice_directory.mkdir(parents=True, exist_ok=True)

    original = {
        "film_transparent": scene.render.film_transparent,
        "resolution_x": scene.render.resolution_x,
        "resolution_y": scene.render.resolution_y,
        "resolution_percentage": scene.render.resolution_percentage,
        "file_format": scene.render.image_settings.file_format,
        "color_mode": scene.render.image_settings.color_mode,
        "filepath": scene.render.filepath,
        "frame_current": scene.frame_current,
        "camera": scene.camera,
        "camera_data": None,
        "hide_render": {obj.name: obj.hide_render for obj in bpy.data.objects if obj.type == "MESH"},
    }

    if scene.camera:
        original["camera_data"] = {
            "lens": scene.camera.data.lens,
            "shift_x": scene.camera.data.shift_x,
            "shift_y": scene.camera.data.shift_y,
        }

    renderable_meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    for obj in renderable_meshes:
        obj.hide_render = obj != model

    scene.render.film_transparent = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    fit_camera_to_animation(scene, model, frames)

    frame_map = []
    for index, frame in enumerate(frames):
        scene.frame_set(frame)
        output_path = slice_directory / f"frame-{index + 1:03d}.png"
        scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
        frame_map.append({"index": index, "sourceFrame": frame})

    scene.render.film_transparent = original["film_transparent"]
    scene.render.resolution_x = original["resolution_x"]
    scene.render.resolution_y = original["resolution_y"]
    scene.render.resolution_percentage = original["resolution_percentage"]
    scene.render.image_settings.file_format = original["file_format"]
    scene.render.image_settings.color_mode = original["color_mode"]
    scene.render.filepath = original["filepath"]
    scene.frame_set(original["frame_current"])

    if original["camera"] and original["camera_data"]:
        original["camera"].data.lens = original["camera_data"]["lens"]
        original["camera"].data.shift_x = original["camera_data"]["shift_x"]
        original["camera"].data.shift_y = original["camera_data"]["shift_y"]

    for obj in renderable_meshes:
        obj.hide_render = original["hide_render"].get(obj.name, False)

    (output_directory / "slice-manifest.json").write_text(
        json.dumps(
            {
                "count": len(frames),
                "sourceFrameStart": scene.frame_start,
                "sourceFrameEnd": scene.frame_end,
                "animationType": "alembic-baked-morph-targets",
                "frames": frame_map,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def find_orchid_model():
    model = bpy.data.objects.get("兰花_形态1_动画缓存")
    if model and model.type == "MESH":
        return model

    model = bpy.data.objects.get("源文件_形态1_FBX_OrchidMeshGrp")
    if model and model.type == "MESH":
        return model

    raise RuntimeError("Missing orchid mesh: expected 兰花_形态1_动画缓存")


def main():
    output_directory, supplied_cache_path = parse_arguments()
    output_directory.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    model = find_orchid_model()
    cache_path = configure_mesh_cache(model, supplied_cache_path)
    if cache_path:
        print(f"Using orchid animation cache: {cache_path}")

    frames = sample_frames(scene)
    baked_model = bake_mesh_sequence(scene, model, frames)
    export_glb(output_directory / "flower.glb", baked_model)
    render_slices(output_directory, scene, baked_model, frames)
    print(f"Exported orchid assets to {output_directory}")


if __name__ == "__main__":
    main()
