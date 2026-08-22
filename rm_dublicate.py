import os
import shutil

folder = os.getcwd()

for name in os.listdir(folder):
    if " - Copy" in name:
        path = os.path.join(folder, name)

        print("Deleting:", name)

        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)

print("Done.")