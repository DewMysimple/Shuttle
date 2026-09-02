import json
import math
import os
import shutil
import sys
from array import array
from pathlib import Path

import bpy
from mathutils import Vector


BODY_NAME_FRAGMENT = "BASIC_BUTTERFLY_BODY"
CAMERA_DISTANCE = 14
CAMERA_ORTHO_SCALE = 7
CAMERA_WORLD_DIRECTION = Vector((0, 0, 1))
CAMERA_ROLL = math.radians(90)
ALPHA_THRESHOLD = 0.45
ALPHA_CORE_DILATION = 6


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


def find_body(meshes):
    body = next((obj for obj in meshes if BODY_NAME_FRAGMENT in obj.name), None)
    if body is None:
        raise RuntimeError("Missing display butterfly body mesh")
    return body


def object_bounds_center(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return sum(corners, Vector()) / len(corners)


def create_front_camera(scene):
    camera_data = bpy.data.cameras.new("蝴蝶_固定正面采样相机")
    camera = bpy.data.objects.new("蝴蝶_固定正面采样相机", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = CAMERA_ORTHO_SCALE
    camera_data.clip_start = 0.1
    camera_data.clip_end = 1000
    return camera


def aim_front_camera(camera, target):
    camera.location = target + CAMERA_WORLD_DIRECTION * CAMERA_DISTANCE
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.rotation_euler.rotate_axis("Z", CAMERA_ROLL)


def clean_rendered_alpha(image_path):
    """Remove tiny disconnected render fragments without touching the butterfly silhouette."""
    image = bpy.data.images.load(str(image_path), check_existing=False)
    width, height = image.size
    pixel_count = width * height
    pixels = array("f", [0.0]) * (pixel_count * 4)
    image.pixels.foreach_get(pixels)

    foreground = bytearray(pixel_count)
    for pixel_index in range(pixel_count):
        if pixels[pixel_index * 4 + 3] >= ALPHA_THRESHOLD:
            foreground[pixel_index] = 1

    keep = bytearray(foreground)
    frontier = [index for index, value in enumerate(foreground) if value]
    for _ in range(ALPHA_CORE_DILATION):
        next_frontier = []
        for current in frontier:
            x = current % width
            y = current // width
            for neighbor_x, neighbor_y in (
                (x - 1, y - 1),
                (x, y - 1),
                (x + 1, y - 1),
                (x - 1, y),
                (x + 1, y),
                (x - 1, y + 1),
                (x, y + 1),
                (x + 1, y + 1),
            ):
                if not (0 <= neighbor_x < width and 0 <= neighbor_y < height):
                    continue
                neighbor = neighbor_y * width + neighbor_x
                if not keep[neighbor]:
                    keep[neighbor] = 1
                    next_frontier.append(neighbor)
        frontier = next_frontier

    for pixel_index in range(pixel_count):
        if keep[pixel_index]:
            continue
        offset = pixel_index * 4
        pixels[offset] = 0.0
        pixels[offset + 1] = 0.0
        pixels[offset + 2] = 0.0
        pixels[offset + 3] = 0.0

    image.pixels.foreach_set(pixels)
    clean_path = image_path.with_name(f"{image_path.stem}.clean.png")
    image.filepath_raw = str(clean_path)
    image.file_format = "PNG"
    image.save()

    bpy.data.images.remove(image)
    clean_path.replace(image_path)


def render_slices(output_directory, scene, camera, body, meshes, frames):
    slice_directory = output_directory / "slices"
    slice_directory.mkdir(parents=True, exist_ok=True)
    staging_directory = output_directory / f".slice-stage-{os.getpid()}"
    staging_directory.mkdir(parents=True, exist_ok=False)
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
        aim_front_camera(camera, object_bounds_center(body))
        output_path = staging_directory / f"frame-{index + 1:03d}.png"
        scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
        clean_rendered_alpha(output_path)
        frame_map.append({"index": index, "sourceFrame": frame})

    for index in range(len(frames)):
        staged_path = staging_directory / f"frame-{index + 1:03d}.png"
        published_path = slice_directory / staged_path.name
        replacement_path = slice_directory / f".{staged_path.stem}.new.png"
        shutil.copy2(staged_path, replacement_path)
        os.replace(replacement_path, published_path)
    shutil.rmtree(staging_directory)

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
        "animationType": "blender-action-every-frame-static-png",
        "sampleMode": "every-integer-frame",
        "view": "fixed-top-front",
        "cameraType": "orthographic",
        "cameraDistance": CAMERA_DISTANCE,
        "cameraOrthoScale": CAMERA_ORTHO_SCALE,
        "cameraTarget": "display-body-bounds-center",
        "displayPlane": "xz-horizontal",
        "timelineAxis": "y",
        "sourceScene": scene.name,
        "sourceFile": "BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_WING_FLAP_ONLY.blend",
        "sourceObjects": [obj.name for obj in meshes],
        "alphaCleanup": {
            "coreThreshold": ALPHA_THRESHOLD,
            "coreDilationPixels": ALPHA_CORE_DILATION,
        },
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
    meshes = find_butterfly_meshes()
    body = find_body(meshes)
    frames = sample_frames(scene)
    camera = create_front_camera(scene)
    camera_data = camera.data
    render_slices(output_directory, scene, camera, body, meshes, frames)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    print(f"Exported {len(frames)} butterfly slices to {output_directory}")


if __name__ == "__main__":
    main()
