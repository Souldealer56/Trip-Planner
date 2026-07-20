import urllib.request
import json
import ipaddress

url = "https://ip-ranges.amazonaws.com/ip-ranges.json"
target_ip = ipaddress.ip_address("2600:1f13:5fd:be00:b402:2c41:2e68:75f3")

print(f"Fetching AWS IP ranges and searching for {target_ip}...")

try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
    
    found = False
    for prefix in data.get("ipv6_prefixes", []):
        net = ipaddress.ip_network(prefix["ipv6_prefix"])
        if target_ip in net:
            print(f"Match found! Network: {prefix['ipv6_prefix']}, Region: {prefix['region']}, Service: {prefix['service']}")
            found = True
            
    if not found:
        print("No matching network found in AWS IP ranges.")
except Exception as e:
    print("Error:", e)
