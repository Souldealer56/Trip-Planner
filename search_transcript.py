import os
import json

transcript_path = r"C:\Users\alex_\.gemini\antigravity-ide\brain\a9d2eb96-f141-4f31-87bb-6f81b36107bb\.system_generated\logs\transcript.jsonl"

print(f"Searching transcript at {transcript_path}...")

if not os.path.exists(transcript_path):
    print("Transcript file does not exist.")
else:
    with open(transcript_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            try:
                data = json.loads(line)
                content = str(data.get("content", ""))
                if "password" in content.lower() or "secret" in content.lower() or "db_" in content.lower():
                    print(f"Line {i} matches:")
                    print(content[:500])
                    print("-" * 50)
            except Exception as e:
                pass
