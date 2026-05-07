import sys

path = 'src/components/system/LogWriteBox.jsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Update the outside select options in LogWriteBox
old_options = """                            <option value="">선택 안 함</option>
                            <option value="투자자">투자자</option>
                            <option value="대주">대주</option>
                            <option value="SI">SI</option>
                            <option value="잠재임차자">잠재임차자</option>"""

new_options = """                            <option value="">선택 안 함</option>
                            <option value="SI">SI</option>
                            <option value="잠재임차사">잠재임차사</option>
                            <option value="운영 파트너">운영 파트너</option>"""

content = content.replace(old_options, new_options)

# 2. Add the select box into the modal
old_modal = """                        <h3 className="text-[16px] font-bold text-white mb-[8px]">신규 이해관계자 등록</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">입력하신 정보가 마스터 데이터에 없습니다.<br/>신규 등록 후 로그를 저장하시겠습니까?</p>
                        <div className="flex items-center gap-[12px] w-full">"""

new_modal = """                        <h3 className="text-[16px] font-bold text-white mb-[8px]">신규 이해관계자 등록</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[20px]">입력하신 정보가 마스터 데이터에 없습니다.<br/>신규 등록 후 로그를 저장하시겠습니까?</p>
                        
                        <div className="w-full mb-[24px] relative">
                            <select 
                                value={stakeholderCat}
                                onChange={(e) => setStakeholderCat(e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-[#333] rounded-[8px] pl-[12px] pr-[30px] py-[10px] text-[13px] text-white outline-none focus:border-[#2997ff] appearance-none cursor-pointer"
                            >
                                <option value="" disabled>이해관계자 분류 선택</option>
                                <option value="SI">SI</option>
                                <option value="잠재임차사">잠재임차사</option>
                                <option value="운영 파트너">운영 파트너</option>
                            </select>
                            <div className="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>

                        <div className="flex items-center gap-[12px] w-full">"""

content = content.replace(old_modal, new_modal)

# 3. Add validation for stakeholderCat inside registerMasterStakeholder
old_register = """    const registerMasterStakeholder = async () => {
        setIsSubmitting(true);"""

new_register = """    const registerMasterStakeholder = async () => {
        if (!stakeholderCat) return alert('이해관계자 분류를 선택해주세요.');
        setIsSubmitting(true);"""

content = content.replace(old_register, new_register)

with open(path, 'w') as f:
    f.write(content)

print("Fixed LogWriteBox modal!")
