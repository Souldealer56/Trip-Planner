import os

gsd_path = r"C:\Users\alex_\.gsd"
if os.path.exists(gsd_path):
    print("Listing .gsd directory:")
    for root, dirs, files in os.walk(gsd_path):
        for file in files:
            print(os.path.join(root, file))
else:
    print(".gsd path does not exist.")
