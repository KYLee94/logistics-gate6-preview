import sys

path = 'src/components/system/workspace/WorkspaceMarketing.jsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Add state
old_state = "const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);"
new_state = """const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);
    const [newStakeholderRole, setNewStakeholderRole] = useState('');"""
content = content.replace(old_state, new_state)

# 2. Update register function
old_register = """    const registerMasterStakeholder = async () => {
        try {
            const { error } = await supabase.from('iota_stakeholder_master').insert({
                company_name: companyQuery
            });
            if (!error) {
                await fetchMasterStakeholders();
                setShowNewStakeholderModal(false);
            } else {
                alert('이해관계자 등록 중 오류가 발생했습니다.');
            }
        } catch (e) {
            console.error(e);
        }
    };"""

new_register = """    const registerMasterStakeholder = async () => {
        if (!newStakeholderRole) return alert('이해관계자 분류를 선택해주세요.');
        try {
            const { error } = await supabase.from('iota_stakeholder_master').insert({
                company_name: companyQuery,
                role_category: newStakeholderRole
            });
            if (!error) {
                await fetchMasterStakeholders();
                setShowNewStakeholderModal(false);
                setNewStakeholderRole('');
            } else {
                alert('이해관계자 등록 중 오류가 발생했습니다.');
            }
        } catch (e) {
            console.error(e);
        }
    };"""
content = content.replace(old_register, new_register)

# 3. Update Modal HTML
old_modal = """            {showNewStakeholderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A1A1A] border border-[#333] rounded-[16px] w-[400px] shadow-2xl p-[24px]">
                        <h3 className="text-white font-bold text-[16px] mb-[16px]">신규 이해관계자 등록</h3>
                        <p className="text-[#A1A1AA] text-[13px] mb-[20px]">입력하신 "{companyQuery}" 기업을 DB에 등록하시겠습니까?</p>
                        <div className="flex gap-[10px] justify-end">
                            <button onClick={() => setShowNewStakeholderModal(false)} className="px-[16px] py-[8px] rounded-[8px] bg-[#333] text-white text-[13px] font-bold">취소</button>
                            <button onClick={registerMasterStakeholder} className="px-[16px] py-[8px] rounded-[8px] bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[13px] font-bold">등록하기</button>
                        </div>
                    </div>
                </div>
            )}"""

new_modal = """            {showNewStakeholderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2997ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">신규 이해관계자 등록</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[20px]">입력하신 정보가 마스터 데이터에 없습니다.<br/>신규 등록 후 로그를 저장하시겠습니까?</p>
                        
                        <div className="w-full mb-[24px] relative">
                            <select 
                                value={newStakeholderRole}
                                onChange={(e) => setNewStakeholderRole(e.target.value)}
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

                        <div className="flex items-center gap-[12px] w-full">
                            <button onClick={() => setShowNewStakeholderModal(false)} className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors cursor-pointer">취소</button>
                            <button onClick={registerMasterStakeholder} className="flex-1 py-[10px] rounded-[8px] bg-[#2997ff] hover:bg-[#0071e3] text-white text-[13px] font-bold transition-colors cursor-pointer">등록 후 저장</button>
                        </div>
                    </div>
                </div>
            )}"""

content = content.replace(old_modal, new_modal)

with open(path, 'w') as f:
    f.write(content)

print("Fixed modal styling and added select box!")
