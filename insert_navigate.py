import sys

path = 'src/components/system/workspace/WorkspaceFinancing.jsx'
with open(path, 'r') as f:
    content = f.read()

nav_func = """    const navigateTo = (path) => {
        const base = import.meta.env.BASE_URL;
        const url = base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
        window.history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

"""

insert_idx = content.find("    const fetchMarketNews = async () => {")

new_content = content[:insert_idx] + nav_func + content[insert_idx:]

with open(path, 'w') as f:
    f.write(new_content)

print("Inserted navigateTo")
