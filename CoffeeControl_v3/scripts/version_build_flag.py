import os
from pathlib import Path

Import("env")


def resolve_version():
    env_version = (os.environ.get("CC_FIRMWARE_VERSION") or "").strip()
    if env_version:
        return env_version

    version_file = Path(env["PROJECT_DIR"]) / "VERSION"
    if version_file.exists():
        file_version = version_file.read_text(encoding="utf-8").strip()
        if file_version:
            return file_version

    return "3.1.0"


version = resolve_version()
env.Append(CPPDEFINES=[("FIRMWARE_VERSION", '\\"{}\\"'.format(version))])
print("[build] FIRMWARE_VERSION={}".format(version))
