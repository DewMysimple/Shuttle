import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


FRONT_ANCHOR_NAME = (
    "展示_BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_源_FBX_01_03_BUTTERFLY_FAST__FLAP_FOLLOW_PATH_1_2"
)
FRONT_CAMERA_DISTANCE = 14
FRONT_CAMERA_LOCAL_DIRECTION = Vector((-1, 0, 0))


def parse_arguments():
    if "--" not in sys.argv:
        raise SystemExit(
            "Usage: blender -b input.blend --python export_butterfly_slices.py -- output_dir"
        )

    separator = sys.argv.index("--")
    arguments = sys.argv[separator + 1 :]
    if not arguments:
        raise SystemExit("Missing output directory")

    return Path(arguments[0]).resolve()


def sample_frames(scene):
    return list(range(scene.frame_start, scene.frame_end + 1))


def find_butterfly_meshes():
    meshes = [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.name.startswith("展示_")
    ]
    if not meshes:
        raise RuntimeError("Missing display butterfly meshes: expected objects named 展示_*")
    return meshes


def find_front_anchor():
    anchor = bpy.data.objects.get(FRONT_ANCHOR_NAME)
    if anchor is None or anchor.type != "EMPTY":
        raise RuntimeError(f"Missing butterfly animation anchor: {FRONT_ANCHOR_NAME}")
    return anchor


def create_front_camera(scene):
    camera_data = bpy.data.cameras.new("蝴蝶_正面采样相机")
    camera = bpy.data.objects.new("蝴蝶_正面采样相机", camera_data)
    scene.collection.objects.link(camera)
    camera_data.lens = 50
    camera_data.clip_start = 0.1
    camera_data.clip_end = 1000
    return camera


def aim_front_camera(camera, anchor):
    origin = anchor.matrix_world.translation.copy()
    rotation = anchor.matrix_world.to_quaternion()
    camera.location = origin + rotation @ (FRONT_CAMERA_LOCAL_DIRECTION * FRONT_CAMERA_DISTANCE)
    camera.rotation_euler = (origin - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_slices(output_directory, scene, camera, anchor, meshes, frames):
    slice_directory = output_directory / "slices"
    slice_directory.mkdir(parents=True, exist_ok=True)
    original_frame = scene.frame_current
    original_camera = scene.camera
    original_render = {
        "film_transparent": scene.render.film_transparent,
        "resolution_x": scene.render.resolution_x,
        "resolution_y": scene.render.resolution_y,
        "resolution_percentage": scene.render.resolution_percentage,
        "file_format": scene.render.image_settings.file_format,
        "color_mode": scene.render.image_settings.color_mode,
        "filepath": scene.render.filepath,
    }
    original_visibility = {obj.name: obj.hide_render for obj in bpy.data.objects if obj.type == "MESH"}
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.hide_render = obj not in meshes

    scene.camera = camera
    scene.render.film_transparent = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    frame_map = []
    for index, frame in enumerate(frames):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        aim_front_camera(camera, anchor)
        scene.render.filepath = str(slice_directory / f"frame-{index + 1:03d}.png")
        bpy.ops.render.render(write_still=True)
        frame_map.append({"index": index, "sourceFrame": frame})

    scene.render.film_transparent = original_render["film_transparent"]
    scene.render.resolution_x = original_render["resolution_x"]
    scene.render.resolution_y = original_render["resolution_y"]
    scene.render.resolution_percentage = original_render["resolution_percentage"]
    scene.render.image_settings.file_format = original_render["file_format"]
    scene.render.image_settings.color_mode = original_render["color_mode"]
    scene.render.filepath = original_render["filepath"]
    scene.frame_set(original_frame)
    scene.camera = original_camera

    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.hide_render = original_visibility.get(obj.name, False)

    manifest = {
        "count": len(frames),
        "sourceFrameStart": scene.frame_start,
        "sourceFrameEnd": scene.frame_end,
        "animationType": "blender-action-sampled-png",
        "view": "tracked-front",
        "cameraDistance": FRONT_CAMERA_DISTANCE,
        "sourceScene": scene.name,
        "sourceObjects": [obj.name for obj in meshes],
        "frames": frame_map,
    }
    (output_directory / "slice-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main():
    output_directory = parse_arguments()
    output_directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.data.scenes.get("ARTIST_EDIT") or bpy.context.scene
    anchor = find_front_anchor()
    meshes = find_butterfly_meshes()
    frames = sample_frames(scene)
    camera = create_front_camera(scene)
    camera_data = camera.data
    render_slices(output_directory, scene, camera, anchor, meshes, frames)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    print(f"Exported {len(frames)} butterfly slices to {output_directory}")


if __name__ == "__main__":
    main()
