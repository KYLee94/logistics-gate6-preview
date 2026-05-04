import re

with open("src/components/system/stakeholder/StakeLp.jsx") as f:
    text = f.read()

# Very basic tag counting, assuming well-formed JSX
div_open = len(re.findall(r'<div\b', text))
div_close = len(re.findall(r'</div\b', text))

print(f"<div> count: {div_open}")
print(f"</div> count: {div_close}")

if div_open > div_close:
    print(f"Missing {div_open - div_close} </div> tags.")
elif div_close > div_open:
    print(f"Missing {div_close - div_open} <div...> tags.")

