import json
import sys
from pathlib import Path

import bpy


def parse_output_directory():
    if "--" not in sys.argv:
        raise SystemExit("Usage: blender -b input.blend --python export_blender_assets.py -- output_dir")
    separator = sys.argv.index("--")
    if separator + 1 >= len(sys.argv):
        raise SystemExit("Missing output directory")
    return Path(sys.argv[separator + 1]).resolve()


def select_objects(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def export_glb(output_path, model, armature, stage):
    select_objects([model, armature, stage])
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=True,
        export_materials="EXPORT",
    )


def render_slices(output_directory, scene, model):
    slice_directory = output_directory / "slices"
    slice_directory.mkdir(parents=True, exist_ok=True)

    original = {
        "film_transparent": scene.render.film_transparent,
        "resolution_x": scene.render.resolution_x,
        "resolution_y": scene.render.resolution_y,
        "resolution_percentage": scene.render.resolution_percentage,
        "file_format": scene.render.image_settings.file_format,
        "color_mode": scene.render.image_settings.color_mode,
        "quality": getattr(scene.render.image_settings, "quality", None),
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

    start_frame = scene.frame_start
    end_frame = scene.frame_end
    frame_map = []

    for index in range(76):
        normalized = index / 75
        frame = int(round(start_frame + normalized * (end_frame - start_frame)))
        scene.frame_set(frame)
        output_path = slice_directory / f"frame-{index + 1:03d}.webp"
        scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
        frame_map.append({"index": index, "sourceFrame": frame})

    scene.render.film_transparent = original["film_transparent"]
    scene.render.resolution_x = original["resolution_x"]
    scene.render.resolution_y = original["resolution_y"]
    scene.render.resolution_percentage = original["resolution_percentage"]
    scene.render.image_settings.file_format = original["file_format"]
    scene.render.image_settings.color_mode = original["color_mode"]
    if original["quality"] is not None and hasattr(scene.render.image_settings, "quality"):
        scene.render.image_settings.quality = original["quality"]

    for obj in renderable_meshes:
        obj.hide_render = False

    (output_directory / "slice-manifest.json").write_text(
        json.dumps(
            {
                "count": 76,
                "sourceFrameStart": start_frame,
                "sourceFrameEnd": end_frame,
                "frames": frame_map,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def main():
    output_directory = parse_output_directory()
    output_directory.mkdir(parents=True, exist_ok=True)

    scene = bpy.data.scenes.get("杜鹃花_模型展示") or bpy.context.scene
    model = bpy.data.objects.get("杜鹃花_高模")
    armature = bpy.data.objects.get("源文件_昆虫骨架")
    stage = bpy.data.objects.get("展示台_杜鹃花")
    missing = [
        name
        for name, obj in (
            ("杜鹃花_高模", model),
            ("源文件_昆虫骨架", armature),
            ("展示台_杜鹃花", stage),
        )
        if obj is None
    ]
    if missing:
        raise RuntimeError(f"Missing required objects: {', '.join(missing)}")

    export_glb(output_directory / "flower.glb", model, armature, stage)
    render_slices(output_directory, scene, model)
    print(f"Exported assets to {output_directory}")


if __name__ == "__main__":
    main()
