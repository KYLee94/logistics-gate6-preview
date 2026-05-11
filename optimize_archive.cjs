const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceArchive.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldFetchBlock = `            try {
                const { data, error } = await supabase
                    .from('iota_weekly_snapshots')
                    .select('*')
                    .eq('workspace', workspaceFilter)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                let fetchedData = data || [];
                
                // Fallback: If no snapshot exists at all, fetch from the live workspace table
                if (fetchedData.length === 0) {
                    const tableMap = {
                        pm: 'iota_pm_tasks',
                        digital: 'iota_digital_tasks',
                        marketing: 'iota_marketing_tasks',
                        fund: 'iota_fund_tasks',
                        development: 'iota_development_tasks',
                        financing: 'iota_financing_tasks',
                        ipr: 'iota_ipr_tasks'
                    };
                    const tableName = tableMap[workspaceFilter];
                    if (tableName) {
                        try {
                            const { data: liveData } = await supabase.from(tableName).select('*').order('created_at', { ascending: false });
                            if (liveData && liveData.length > 0) {
                                fetchedData.push({
                                    id: workspaceFilter + '-live-fallback',
                                    workspace: workspaceFilter,
                                    week_label: '26년 5월 3주',
                                    created_at: new Date().toISOString(),
                                    snapshot_data: liveData
                                });
                            }
                        } catch (e) {
                            console.error('Live data fetch fallback failed', e);
                        }
                    }
                }`;

const newFetchBlock = `            try {
                const tableMap = {
                    pm: 'iota_pm_tasks',
                    digital: 'iota_digital_tasks',
                    marketing: 'iota_marketing_tasks',
                    fund: 'iota_fund_tasks',
                    development: 'iota_development_tasks',
                    financing: 'iota_financing_tasks',
                    ipr: 'iota_ipr_tasks'
                };
                const tableName = tableMap[workspaceFilter];

                // 병렬 통신(Promise.all)을 통한 로딩 속도 최적화
                const [snapshotRes, liveRes] = await Promise.all([
                    supabase.from('iota_weekly_snapshots').select('*').eq('workspace', workspaceFilter).order('created_at', { ascending: false }),
                    tableName ? supabase.from(tableName).select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: null, error: null })
                ]);
                
                if (snapshotRes.error) throw snapshotRes.error;
                let fetchedData = snapshotRes.data || [];
                
                // Fallback: If no snapshot exists, use the pre-fetched live data
                if (fetchedData.length === 0 && liveRes.data && liveRes.data.length > 0) {
                    fetchedData.push({
                        id: workspaceFilter + '-live-fallback',
                        workspace: workspaceFilter,
                        week_label: '26년 5월 3주',
                        created_at: new Date().toISOString(),
                        snapshot_data: liveRes.data
                    });
                }`;

content = content.replace(oldFetchBlock, newFetchBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Archive loading optimized successfully');
