const fs = require('fs');
const path = require('path');

const dir = 'src/components/system/workspace';
const files = [
    'WorkspaceDevelopment.jsx',
    'WorkspaceDigital.jsx',
    'WorkspaceFinancing.jsx',
    'WorkspaceFund.jsx',
    'WorkspaceIpr.jsx',
    'WorkspaceMarketing.jsx',
    'WorkspacePm.jsx'
];

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Add state if not exists
    if (!content.includes('isSubmittingTask')) {
        content = content.replace(
            "const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);",
            "const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);\n    const [isSubmittingTask, setIsSubmittingTask] = useState(false);"
        );
    }

    // 2. Add setIsSubmittingTask(true) to handleSaveRow
    if (!content.includes('setIsSubmittingTask(true);')) {
        // WorkspaceDigital has slightly different validation maybe?
        // Let's replace right after "const handleSaveRow = async () => {"
        content = content.replace(
            /const handleSaveRow = async \(\) => \{\n(.*?)if \(\!newTask\.task_name\) return alert\('Task 명을 입력해주세요\.'\);/g,
            "const handleSaveRow = async () => {\n$1if (!newTask.task_name) return alert('Task 명을 입력해주세요.');\n        setIsSubmittingTask(true);"
        );
    }

    // 3. Add setIsSubmittingTask(false) before fetchTasks() inside handleSaveRow
    // We can just replace "fetchTasks();" inside handleSaveRow, but it might be tricky.
    // Notice that in handleSaveRow, the last lines are:
    // setIsAdding(false);
    // fetchTasks();
    // };
    // We can replace "setIsAdding(false);\n        fetchTasks();" with "setIsAdding(false);\n        setIsSubmittingTask(false);\n        fetchTasks();"
    if (content.includes('setIsAdding(false);') && !content.includes('setIsSubmittingTask(false);')) {
        content = content.replace(
            /setIsAdding\(false\);\n(.*?)fetchTasks\(\);/g,
            "setIsAdding(false);\n        setIsSubmittingTask(false);\n$1fetchTasks();"
        );
        // Sometimes it might be in `finally` block in WorkspaceDigital
        content = content.replace(
            /setIsAdding\(false\);\n(.*?)\}/g,
            "setIsAdding(false);\n        setIsSubmittingTask(false);\n$1}"
        );
    }

    // 4. Update the button
    content = content.replace(
        /<button onClick=\{handleSaveRow\} className="px-5 py-2 bg-\[#059669\]\/20 text-\[#34d399\] border border-\[#059669\]\/30 rounded-\[10px\] text-\[14px\] font-bold hover:bg-\[#059669\]\/40 transition-colors cursor-pointer">저장<\/button>/g,
        `<button onClick={handleSaveRow} disabled={isSubmittingTask} className="px-5 py-2 bg-[#059669]/20 text-[#34d399] border border-[#059669]/30 rounded-[10px] text-[14px] font-bold hover:bg-[#059669]/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{isSubmittingTask ? '저장 중...' : '저장'}</button>`
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
}
