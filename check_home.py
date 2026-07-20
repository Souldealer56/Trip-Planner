import os

home = os.path.expanduser("~")
print("Home directory:", home)

for item in os.listdir(home):
    if item.startswith(".") or "supabase" in item.lower():
        full_path = os.path.join(home, item)
        if os.path.isdir(full_path):
            print(f"Dir: {item}")
        else:
            print(f"File: {item}")
