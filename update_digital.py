import re

file_path = "src/components/system/workspace/WorkspaceDigital.jsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add states
state_addition = """    const [selectedTheme, setSelectedTheme] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showAuthAlert, setShowAuthAlert] = useState(false);

    // Asset filter and custom assets
    const [assetFilter, setAssetFilter] = useState('ALL');
    const [customAssets, setCustomAssets] = useState([]);
    const [showNewAssetModal, setShowNewAssetModal] = useState(false);
    const [newAssetName, setNewAssetName] = useState('');
    const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);"""

content = content.replace(
    """    const [selectedTheme, setSelectedTheme] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showAuthAlert, setShowAuthAlert] = useState(false);""", 
    state_addition
)

# 2. Update useEffect to load custom assets
use_effect_target = """    useEffect(() => {
        fetchTasks();
    }, []);"""

use_effect_replacement = """    useEffect(() => {
        fetchTasks();
        const savedAssets = localStorage.getItem('iota_marketing_custom_assets');
        if (savedAssets) setCustomAssets(JSON.parse(savedAssets));
    }, []);

    const registerNewAsset = () => {
        if (!newAssetName.trim()) return;
        setIsSubmittingAsset(true);
        setTimeout(() => {
            const updated = [...customAssets, newAssetName.trim()];
            setCustomAssets(updated);
            localStorage.setItem('iota_marketing_custom_assets', JSON.stringify(updated));
            setNewTask({...newTask, related_asset: newAssetName.trim()});
            setIsSubmittingAsset(false);
            setShowNewAssetModal(false);
            setNewAssetName('');
        }, 300);
    };"""

content = content.replace(use_effect_target, use_effect_replacement)

# 3. Add filtering logic before sortedTasks
filter_logic_target = """    const sortedTasks = [...tasks].sort((a, b) => {"""
filter_logic_replacement = """    const isCoreAsset = (asset) => {
        if (!asset || typeof asset !== 'string') return false;
        const lower = asset.toLowerCase();
        return lower.includes('iota') || lower.includes('이오타') || lower.includes('427') || lower.includes('816') || lower.includes('421');
    };

    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const filteredByAssetTasks = safeTasks.filter(t => assetFilter === 'ALL' || isCoreAsset(t.related_asset));

    const sortedTasks = [...filteredByAssetTasks].sort((a, b) => {"""

content = content.replace(filter_logic_target, filter_logic_replacement)

# 4. Filter logic part 2: updating the mapped tasks variable
map_logic_target = """(projectShowAll ? sortedTasks : sortedTasks.slice(0, 5))"""
map_logic_replacement = """(projectShowAll ? sortedTasks : sortedTasks.slice(0, 5))"""
# Actually, the render mapping already uses sortedTasks, so sortedTasks will just be smaller. 
# But wait, we also have selectedTheme filtering.
# Let's check how selectedTheme is applied. 
# In WorkspaceDigital, selectedTheme is currently NOT filtering sortedTasks in the definition, but maybe during map?
# Wait! Let's check how selectedTheme filters currently.

with open(file_path, "w") as f:
    f.write(content)
