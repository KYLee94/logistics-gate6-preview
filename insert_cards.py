import sys

path = 'src/components/system/workspace/WorkspaceFinancing.jsx'
with open(path, 'r') as f:
    content = f.read()

old_str = """                    <div className="w-full h-[44px]"></div>

                    {/* 월별 이자 발생 시계열 */}"""

new_str = """                    {/* IOTA One, Two Details */}
                    <div className="w-full mt-[32px] flex flex-col gap-[38px]">
                        <VehicleDetailCard 
                            id="section-427" 
                            vehicleId="427"
                            title="IOTA One (427 PFV) 파이낸싱 구조" 
                            totalAmountStr={formatAmount(displayTotal427)} 
                            data={iotaData[427]['Refinancing']} 
                            toggleContent={null}
                        />
                        <VehicleDetailCard 
                            id="section-816" 
                            vehicleId="816"
                            title="IOTA Two (816 PFV) 파이낸싱 구조" 
                            totalAmountStr={formatAmount(displayTotal816)} 
                            data={iotaData[816]['Refinancing']} 
                            toggleContent={null}
                        />
                    </div>

                    <div className="w-full h-[44px]"></div>

                    {/* 월별 이자 발생 시계열 */}"""

content = content.replace(old_str, new_str)

with open(path, 'w') as f:
    f.write(content)

print("Inserted cards")
