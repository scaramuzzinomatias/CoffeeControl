import os

Import("env")

version = os.environ.get("CC_FIRMWARE_VERSION", "3.1.0").strip() or "3.1.0"
env.Append(CPPDEFINES=[("FIRMWARE_VERSION", '\\"{}\\"'.format(version))])
print("[build] FIRMWARE_VERSION={}".format(version))
