import re

file_path = "src/components/system/LogWriteBox.jsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Insert particle logic
target_logic = """    const filteredMentions = mentionCandidates.filter(name => name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);"""
replacement_logic = """    const filteredMentions = mentionCandidates.filter(name => name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

    const getParticle = (word) => {
        if (!word) return '와';
        const lastChar = word.charAt(word.length - 1);
        if (/[a-zA-Z]/.test(lastChar)) {
            const upperChar = lastChar.toUpperCase();
            if (['L', 'M', 'N', 'R'].includes(upperChar)) return '과';
            return '와';
        }
        const code = lastChar.charCodeAt(0);
        if (code >= 0xAC00 && code <= 0xD7A3) {
            return (code - 0xAC00) % 28 > 0 ? '과' : '와';
        }
        return '와';
    };
    
    const displayLabel = workspaceLabel ? workspaceLabel.split('-')[0].trim() : '';
    const collapsedText = displayLabel ? `${displayLabel}${getParticle(displayLabel)} 협업 및 논의가 필요한 사항, 또는 공유할 내용을 등록하세요.` : '주요 공유사항, 협업 및 논의가 필요한 내용을 등록하세요.';"""

content = content.replace(target_logic, replacement_logic)

# 2. Update JSX
target_jsx = """<span className="text-[#bcdbdb] font-bold text-[16px]">주요 공유사항, 협업 및 논의가 필요한 내용을 등록하세요.</span>"""
replacement_jsx = """<span className="text-[#bcdbdb] font-bold text-[16px]">{collapsedText}</span>"""

content = content.replace(target_jsx, replacement_jsx)

with open(file_path, "w") as f:
    f.write(content)

print("Particle logic updated")
