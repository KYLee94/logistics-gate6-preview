with open("src/components/system/stakeholder/StakeLp.jsx") as f:
    lines = f.readlines()

# find the second to last </div> and remove it
for i in range(len(lines)-1, -1, -1):
    if '</div>' in lines[i]:
        del lines[i]
        break

with open("src/components/system/stakeholder/StakeLp.jsx", "w") as f:
    f.writelines(lines)
