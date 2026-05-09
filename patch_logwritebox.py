import os

filepath = 'src/components/system/LogWriteBox.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# Add title state
content = content.replace(
    "const [content, setContent] = useState('');",
    "const [title, setTitle] = useState('');\n    const [content, setContent] = useState('');"
)

# Update submit
content = content.replace(
    "summary: content.slice(0, 160),",
    "summary: title,"
)

# Reset title
content = content.replace(
    "setContent('');",
    "setTitle('');\n            setContent('');"
)

# Validation pre-submit
content = content.replace(
    "if (!content.trim()) return;",
    "if (!title.trim() || !content.trim()) return;"
)

# Render Input
# We have `<!-- Text Area -->` comment or `{/* Text Area */}`
# Wait, let's find the exact place
input_jsx = """                <div className="w-full px-[20px] pt-[20px] pb-[24px] relative bg-transparent">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="제목을 입력하세요"
                        className="w-full bg-transparent text-[#E5E5E5] text-[16px] font-bold outline-none mb-[12px] border-b border-[#333] pb-[12px]"
                        required
                    />"""

content = content.replace(
    """                <div className="w-full px-[20px] pt-[20px] pb-[24px] relative bg-transparent">""",
    input_jsx
)

with open(filepath, 'w') as f:
    f.write(content)

