"""Render every Cam_* in /Game/Maps/House to PNG with the Movie Render Queue.

Run with the editor open on the House map (rendering needs the viewport):
  UnrealEditor BrickHouse.uproject /Game/Maps/House -ExecutePythonScript=Scripts/render.py
Stills land in ~/Desktop/home-3d/brick/renders_unreal/<camera>.png; the
editor quits when the queue is done. Pass shot names in the BRICK_SHOTS
environment variable (comma-separated) to render only those.
"""

import os

import unreal

OUT = os.path.expanduser("~/Desktop/home-3d/brick/renders_unreal")
SEQ = "/Game/Brick/Sequences"
MAP = "/Game/Maps/House"
RES = (1920, 1200)

tools = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def shot_sequence(cam):
    """A one-frame level sequence that cuts to this camera."""
    name = f"Shot_{cam.get_actor_label().removeprefix('Cam_')}"
    path = f"{SEQ}/{name}"
    if eal.does_asset_exist(path):
        # an existing shot is cleared and reused: no overwrite prompt
        seq = eal.load_asset(path)
        for b in seq.get_bindings():
            b.remove()
        for t in seq.get_tracks():
            seq.remove_track(t)
    else:
        seq = tools.create_asset(name, SEQ, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    seq.set_display_rate(unreal.FrameRate(24, 1))
    seq.set_playback_start(0)
    seq.set_playback_end(1)
    binding = seq.add_possessable(cam)
    cut_track = seq.add_track(unreal.MovieSceneCameraCutTrack)
    cut = cut_track.add_section()
    cut.set_range(0, 1)
    cut.set_camera_binding_id(seq.get_binding_id(binding))
    eal.save_loaded_asset(seq)
    return seq


def configure(job, name):
    cfg = job.get_configuration()
    out = cfg.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    out.output_directory = unreal.DirectoryPath(OUT)
    out.file_name_format = name
    out.output_resolution = unreal.IntPoint(*RES)
    out.override_existing_output = True
    cfg.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    cfg.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
    aa = cfg.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
    aa.spatial_sample_count = 1
    aa.temporal_sample_count = 8
    aa.override_anti_aliasing = True
    aa.anti_aliasing_method = unreal.AntiAliasingMethod.AAM_NONE
    # Lumen needs frames to settle before the still is taken
    aa.engine_warm_up_count = 32
    aa.render_warm_up_count = 32
    aa.use_camera_cut_for_warm_up = False
    # wait for shader compilation and streaming before the still is taken:
    # set every flush/wait switch this engine version offers, and log them
    go = cfg.find_or_add_setting_by_class(unreal.MoviePipelineGameOverrideSetting)
    flags = [n for n in dir(go) if not n.startswith("_") and any(k in n for k in ("flush", "shader", "wait"))]
    for n in flags:
        try:
            if isinstance(go.get_editor_property(n), bool):
                go.set_editor_property(n, True)
        except Exception:
            pass
    unreal.log(f"[brick] game overrides set: {flags}")
    cv = cfg.find_or_add_setting_by_class(unreal.MoviePipelineConsoleVariableSetting)
    for k, v in {
        "r.Lumen.ScreenProbeGather.DownsampleFactor": 8,
        "r.Lumen.Reflections.DownsampleFactor": 1,
        "r.Shadow.Virtual.SMRT.RayCountDirectional": 16,
        "r.Tonemapper.Sharpen": 0.6,
    }.items():
        cv.add_or_update_console_variable(k, v)


def main():
    only = [s for s in os.environ.get("BRICK_SHOTS", "").split(",") if s]
    os.makedirs(OUT, exist_ok=True)
    cams = [a for a in actors.get_all_level_actors()
            if isinstance(a, unreal.CineCameraActor) and a.get_actor_label().startswith("Cam_")]
    if only:
        cams = [c for c in cams if c.get_actor_label().removeprefix("Cam_") in only]
    subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    queue = subsystem.get_queue()
    queue.delete_all_jobs()
    for cam in cams:
        seq = shot_sequence(cam)
        job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
        job.job_name = cam.get_actor_label()
        job.map = unreal.SoftObjectPath(MAP)
        job.sequence = unreal.SoftObjectPath(seq.get_path_name())
        configure(job, cam.get_actor_label().removeprefix("Cam_"))
    unreal.log(f"[brick] level has {len(actors.get_all_level_actors())} actors")
    unreal.log(f"[brick] rendering {len(cams)} shots to {OUT}")
    if not cams:
        unreal.SystemLibrary.quit_editor()
        return
    executor = subsystem.render_queue_with_executor(unreal.MoviePipelinePIEExecutor)

    def done(ex, ok):
        unreal.log(f"[brick] render finished, success={ok}")
        unreal.SystemLibrary.quit_editor()

    executor.on_executor_finished_delegate.add_callable(done)


# -ExecutePythonScript runs before the editor world is up: wait a few ticks,
# then open the map and start.
_ticks = {"n": 0, "handle": None}


def _wait(dt):
    _ticks["n"] += 1
    if _ticks["n"] == 30:
        unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(MAP)
    if _ticks["n"] == 90:
        unreal.unregister_slate_post_tick_callback(_ticks["handle"])
        try:
            main()
        except Exception:
            import traceback
            unreal.log_error("[brick] FAILED " + traceback.format_exc())
            unreal.SystemLibrary.quit_editor()


_ticks["handle"] = unreal.register_slate_post_tick_callback(_wait)
