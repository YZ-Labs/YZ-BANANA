const axios = require('axios');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { DateTime, Duration } = require('luxon');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class BananaBot {
    constructor() {
        this.base_url = 'https://interface.carv.io/banana';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://banana.carv.io',
            'Referer': 'https://banana.carv.io/',
            'Sec-CH-UA': '"Not A;Brand";v="99", "Android";v="12"',
            'Sec-CH-UA-Mobile': '?1',
            'Sec-CH-UA-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36',
            'X-App-ID': 'carv',
        };        
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async login(queryId, proxy) {
        const loginPayload = {
            tgInfo: queryId,
            InviteCode: ""
        };

        try {
            const response = await axios.post(`${this.base_url}/login`, loginPayload, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
            await this.sleep(1000);

            const responseData = response.data;
            if (responseData.data && responseData.data.token) {
                return responseData.data.token;
            } else {
                this.log('找不到token');
                return null;
            }
        } catch (error) {
            this.log('登录错误: ' + error.message);
            return null;
        }
    }

    async achieveQuest(questId, proxy) {
        const achievePayload = { quest_id: questId };
        try {
            return await axios.post(`${this.base_url}/achieve_quest`, achievePayload, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
        } catch (error) {
            this.log('执行任务时的错误:' + error.message);
        }
    }

    async claimQuest(questId, proxy) {
        const claimPayload = { quest_id: questId };
        try {
            return await axios.post(`${this.base_url}/claim_quest`, claimPayload, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
        } catch (error) {
            this.log('索赔错误:' + error.message);
        }
    }

    async doClick(clickCount, proxy) {
        const clickPayload = { clickCount: clickCount };
        try {
            const response = await axios.post(`${this.base_url}/do_click`, clickPayload, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
            return response.data;
        } catch (error) {
            this.log('点击错误:' + error.message);
            return null;
        }
    }
    

    async getLotteryInfo(proxy) {
        try {
            return await axios.get(`${this.base_url}/get_lottery_info`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
        } catch (error) {
            this.log('获取信息时出错:' + error.message);
        }
    }

    async claimLottery(proxy) {
        const claimPayload = { claimLotteryType: 1 };
        try {
            return await axios.post(`${this.base_url}/claim_lottery`, claimPayload, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
        } catch (error) {
            this.log('错误不能收割: ' + error.message);
        }
    }

    async doLottery(proxy) {
        try {
            return await axios.post(`${this.base_url}/do_lottery`, {}, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
        } catch (error) {
            this.log('索赔tap错误: ' + error.message);
        }
    }

    calculateRemainingTime(lotteryData) {
        const lastCountdownStartTime = lotteryData.last_countdown_start_time || 0;
        const countdownInterval = lotteryData.countdown_interval || 0;
        const countdownEnd = lotteryData.countdown_end || false;

        if (!countdownEnd) {
            const currentTime = DateTime.now();
            const lastCountdownStart = DateTime.fromMillis(lastCountdownStartTime);
            const elapsedTime = currentTime.diff(lastCountdownStart, 'minutes').as('minutes');
            const remainingTimeMinutes = Math.max(countdownInterval - elapsedTime, 0); 
            return remainingTimeMinutes;
        }
        return 0;
    }

    askUserChoice(prompt) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === 'yes');
            });
        });
    }

    async equipBestBanana(currentEquipBananaId, proxy) {
        try {
            const response = await axios.get(`${this.base_url}/get_banana_list`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
            const bananas = response.data.data.banana_list;
    
            const eligibleBananas = bananas.filter(banana => banana.count >= 1);
            if (eligibleBananas.length > 0) {
                const bestBanana = eligibleBananas.reduce((prev, current) => {
                    return (prev.daily_peel_limit > current.daily_peel_limit) ? prev : current;
                });
    
                if (bestBanana.banana_id === currentEquipBananaId) {
                    this.log(colors.green(`使用最好的香蕉:${colors.yellow(bestBanana.name)} | Price : ${colors.yellow(bestBanana.sell_exchange_peel)} Peels / ${colors.yellow(bestBanana.sell_exchange_usdt)} USDT.`));
                    
                    if (bestBanana.sell_exchange_usdt >= 1) {
                        this.log(colors.red(`成功了!香蕉的USDT值: ${colors.yellow(bestBanana.sell_exchange_usdt)} USDT`));
                        process.exit(0);
                    }
                    
                    return;
                }
    
                const equipPayload = { bananaId: bestBanana.banana_id };
                const equipResponse = await axios.post(`${this.base_url}/do_equip`, equipPayload, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
                if (equipResponse.data.code === 0) {
                    this.log(colors.green(`最好的香蕉是什么: ${colors.yellow(bestBanana.name)} 跟 ${bestBanana.daily_peel_limit} 🍌/ DAY`));
                } else {
                    this.log(colors.red('使用香蕉失败!'));
                }
            } else {
                this.log(colors.red('没有发现香蕉!'));
            }
        } catch (error) {
            this.log('错了:' + error.message);
        }
    }
	
    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }));
    }

    async doSpeedup(proxy, maxSpeedups = 3) {
        let speedupsPerformed = 0;
        while (speedupsPerformed < maxSpeedups) {
            try {
                const response = await axios.post(`${this.base_url}/do_speedup`, {}, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
                if (response.data.code === 0) {
                    const speedupCount = response.data.data.speedup_count;
                    const lotteryInfo = response.data.data.lottery_info;
                    speedupsPerformed++;
                    this.log(colors.green(`加速成功!剩下 ${speedupCount} 次speedup。已经做过了 ${speedupsPerformed}/${maxSpeedups} 次`));
    
                    if (lotteryInfo.countdown_end === true) {
                        this.log(colors.yellow('倒计时结束了。正在领取...'));
                        await this.claimLottery(proxy);
                    }
    
                    if (speedupCount === 0 || speedupsPerformed >= maxSpeedups) {
                        this.log(colors.yellow(`是加速结束还是达到极限 ${maxSpeedups} 次`));
                        return lotteryInfo;
                    }
                } else {
                    this.log(colors.red('加速失败!'));
                    return null;
                }
            } catch (error) {
                this.log('执行加速时出错: ' + error.message);
                return null;
            }
        }
    }

	async processAccount(queryId, proxy, isFirstAccount = false, doQuests) {
        let remainingTimeMinutes = Infinity;
        const token = await this.login(queryId, proxy);
        if (token) {
            this.headers['Authorization'] = token;
            this.headers['Cache-Control'] = 'no-cache';
            this.headers['Pragma'] = 'no-cache';
    
            try {
                const userInfoResponse = await axios.get(`${this.base_url}/get_user_info`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
                this.log(colors.green('登录成功!'));
                await this.sleep(1000);
                const userInfoData = userInfoResponse.data;
    
                const userInfo = userInfoData.data || {};
                const peel = userInfo.peel || 'N/A';
                const usdt = userInfo.usdt || 'N/A';
                const todayClickCount = userInfo.today_click_count || 0;
                const maxClickCount = userInfo.max_click_count || 0;
                const currentEquipBananaId = userInfo.equip_banana_id || 0;
                const speedup = userInfo.speedup_count || 0;
    
                this.log(colors.green(`Balance : ${colors.white(peel)}`));
                this.log(colors.green(`USDT : ${colors.white(usdt)}`));
                this.log(colors.green(`Speed Up : ${colors.white(speedup)}`));
                this.log(colors.green(`今天有没有tap : ${colors.white(todayClickCount)} 次`));
    
                await this.equipBestBanana(currentEquipBananaId, proxy);

                try {
                    const lotteryInfoResponse = await this.getLotteryInfo(proxy);
                    await this.sleep(1000);
                    const lotteryInfoData = lotteryInfoResponse.data;
                    let remainLotteryCount = (lotteryInfoData.data || {}).remain_lottery_count || 0;
                    remainingTimeMinutes = this.calculateRemainingTime(lotteryInfoData.data || {});
    
                    if (remainingTimeMinutes <= 0) {
                        this.log(colors.yellow('开始索赔…'));
                        await this.claimLottery(proxy);
                        
                        const updatedLotteryInfoResponse = await this.getLotteryInfo(proxy);
                        await this.sleep(1000);
                        const updatedLotteryInfoData = updatedLotteryInfoResponse.data;
                        remainLotteryCount = (updatedLotteryInfoData.data || {}).remain_lottery_count || 0;
                        remainingTimeMinutes = this.calculateRemainingTime(updatedLotteryInfoData.data || {});
                    }
    
                    if (speedup > 0) {
                        const maxSpeedups = speedup > 3 ? 3 : speedup;
                        this.log(colors.yellow(`最大速度 ${maxSpeedups} 次...`));
                        const speedupLotteryInfo = await this.doSpeedup(proxy, maxSpeedups);
                        if (speedupLotteryInfo) {
                            remainingTimeMinutes = this.calculateRemainingTime(speedupLotteryInfo);
                        }
                    }

                    const remainingDuration = Duration.fromMillis(remainingTimeMinutes * 60 * 1000);
                    const remainingHours = Math.floor(remainingDuration.as('hours'));
                    const remainingMinutes = Math.floor(remainingDuration.as('minutes')) % 60;
                    const remainingSeconds = Math.floor(remainingDuration.as('seconds')) % 60;
    
                    this.log(colors.yellow(`还剩: ${remainingHours} 小时 ${remainingMinutes} 分钟 ${remainingSeconds} 秒`));
    
					this.log(colors.yellow(`收获: ${colors.white(remainLotteryCount)}`));
					if (remainLotteryCount > 0) {
						this.log('开始收获…');
						for (let i = 0; i < remainLotteryCount; i++) {
							this.log(`正在收获第二次 ${i + 1}/${remainLotteryCount}...`);
							const doLotteryResponse = await this.doLottery(proxy);

							if (doLotteryResponse.status === 200) {
								const lotteryResult = doLotteryResponse.data.data || {};
								const bananaName = lotteryResult.name || 'N/A';
								const sellExchangePeel = lotteryResult.sell_exchange_peel || 'N/A';
								const sellExchangeUsdt = lotteryResult.sell_exchange_usdt || 'N/A';

								this.log(`收获成功了 ${bananaName}`);
								console.log(colors.yellow(`     - Banana Name : ${bananaName}`));
								console.log(colors.yellow(`     - Peel Limit : ${lotteryResult.daily_peel_limit || 'N/A'}`));
								console.log(colors.yellow(`     - Price : ${sellExchangePeel} Peel, ${sellExchangeUsdt} USDT`));
								await this.sleep(1000);
							}
						}
						this.log('收获完成');
					}
                } catch (error) {
                    this.log('没有信息 ' + error.message);
                }
    
                if (todayClickCount < maxClickCount) {
                    const clickCount = maxClickCount - todayClickCount;
                    if (clickCount > 0) {
                        this.log(colors.magenta(`你有 ${clickCount} 次 tap...`));
                        
                        const parts = [];
                        let remaining = clickCount;
                        for (let i = 0; i < 9; i++) {
                            const part = Math.floor(Math.random() * (remaining / (10 - i))) * 2;
                            parts.push(part);
                            remaining -= part;
                        }
                        parts.push(remaining); 
                        
                        for (const part of parts) {
                            this.log(colors.magenta(`正在进行 ${part} 次...`));
                            const response = await this.doClick(part, proxy);
                            if (response && response.code === 0) {
                                const peel = response.data.peel || 0;
                                const speedup = response.data.speedup || 0;
                                this.log(colors.magenta(`收到 ${peel} Peel, ${speedup} Speedup...`));
                            } else {
                                this.log(colors.red(`错误第 ${part} 次.`));
                            }
                            await this.sleep(1000);
                        }
                
                        const userInfoResponse = await axios.get(`${this.base_url}/get_user_info`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
                        const userInfo = userInfoResponse.data.data || {};
                        const updatedSpeedup = userInfo.speedup_count || 0;
                
                        if (updatedSpeedup > 0) {
                            this.log(colors.yellow(`执行speedup, 你有 ${updatedSpeedup} 次...`));
                            const speedupLotteryInfo = await this.doSpeedup(proxy);
                            if (speedupLotteryInfo) {
                                remainingTimeMinutes = this.calculateRemainingTime(speedupLotteryInfo);
                            }
                        }
                
                        const remainingDuration = Duration.fromMillis(remainingTimeMinutes * 60 * 1000);
                        const remainingHours = Math.floor(remainingDuration.as('hours'));
                        const remainingMinutes = Math.floor(remainingDuration.as('minutes')) % 60;
                        const remainingSeconds = Math.floor(remainingDuration.as('seconds')) % 60;
                
                        this.log(colors.yellow(`还剩: ${remainingHours} 小时 ${remainingMinutes} 分钟 ${remainingSeconds} 秒`));
                    } else {
                        this.log(colors.red('不能tap，已经达到极限了!'));
                    }
                } else {
                    this.log(colors.red('不能tap，已经达到极限了!'));
                }        
                
				if (doQuests) {

					try {
						const questListResponse = await axios.get(`${this.base_url}/get_quest_list`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
						await this.sleep(1000);
						const questListData = questListResponse.data;
		
						const questList = (questListData.data || {}).quest_list || [];
						for (let i = 0; i < questList.length; i++) {
							const quest = questList[i];
							const questName = quest.quest_name || 'N/A';
							let isAchieved = quest.is_achieved || false;
							let isClaimed = quest.is_claimed || false;
							const questId = quest.quest_id;
		
							if (!isAchieved) {
								await this.achieveQuest(questId, proxy);
								await this.sleep(1000);
		
								const updatedQuestListResponse = await axios.get(`${this.base_url}/get_quest_list`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
								const updatedQuestListData = updatedQuestListResponse.data;
								const updatedQuest = updatedQuestListData.data.quest_list.find(q => q.quest_id === questId);
								isAchieved = updatedQuest.is_achieved || false;
							}
		
							if (isAchieved && !isClaimed) {
								await this.claimQuest(questId, proxy);
								await this.sleep(1000);
		
								const updatedQuestListResponse = await axios.get(`${this.base_url}/get_quest_list`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
								const updatedQuestListData = updatedQuestListResponse.data;
								const updatedQuest = updatedQuestListData.data.quest_list.find(q => q.quest_id === questId);
								isClaimed = updatedQuest.is_claimed || false;
							}
		
							const achievedStatus = isAchieved ? '完成':'失败';
							const claimedStatus = isClaimed ? '已领取' : '未领取';
		
							const questNameColor = colors.cyan;
							const achievedColor = isAchieved ? colors.green : colors.red;
							const claimedColor = isClaimed ? colors.green : colors.red;
		
							if (!questName.toLowerCase().includes('bind')) {
								this.log(`${colors.white(`下班了吗 `)}${questNameColor(questName)} ${colors.blue('...')}状态 : ${achievedColor(achievedStatus)} | ${claimedColor(claimedStatus)}`);
							}
						}
		
						const progress = questListData.data.progress || '';
						const isClaimedQuestLottery = questListData.data.is_claimed || false;
		
						if (isClaimedQuestLottery) {
							this.log(colors.yellow(`索赔任务可用: ${progress}`));
							const claimQuestLotteryResponse = await axios.post(`${this.base_url}/claim_quest_lottery`, {}, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
							if (claimQuestLotteryResponse.data.code === 0) {
								this.log(colors.green('索赔任务成功了!'));
							} else {
								this.log(colors.red('索赔任务失败了!'));
							}
						}
		
					} catch (error) {
						this.log(colors.red('获取任务列表时出错: ' + error.message));
					}
				} else {
				}
    
            } catch (error) {
                this.log('由于缺少通知代码，无法找到加载用户信息和任务列表。');
            }
    
            if (isFirstAccount) {
                return remainingTimeMinutes;
            }
        }
        return null;
    }    

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractUserData(queryId) {
        const urlParams = new URLSearchParams(queryId);
        const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
        return {
            auth_date: urlParams.get('auth_date'),
            hash: urlParams.get('hash'),
            query_id: urlParams.get('query_id'),
            user: user
        };
    }

    async Countdown(seconds) {
        for (let i = Math.floor(seconds); i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== 做完所有的帐，等下 ${i} 秒 继续循环 =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }    

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`无法检查代理的IP。code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`代理IP检查错误: ${error.message}`);
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
        
        const proxyFile = path.join(__dirname, 'proxy.txt');
        const proxies = fs.readFileSync(proxyFile, 'utf8').split('\n').filter(Boolean);
		const doQuestsAnswer = await this.askQuestion('是否继续工作? (y/n): ');
		const doQuests = doQuestsAnswer.toLowerCase() === 'y';
        while (true) {
            let minRemainingTime = Infinity;
    
            for (let i = 0; i < userData.length; i++) {
                const queryId = userData[i];
                const data = this.extractUserData(queryId);
                const userDetail = data.user;
                const proxy = proxies[i % proxies.length];
                
                try {
                    const proxyIP = await this.checkProxyIP(proxy);
                    if (queryId) {
                        console.log(`\n========== 账户 ${i + 1} | ${userDetail.first_name} | IP: ${proxyIP} ==========`);
						const remainingTime = await this.processAccount(queryId, proxy, i === 0, doQuests);
    
                        if (i === 0 && remainingTime !== null) {
                            minRemainingTime = remainingTime;
                        }
                    }
                } catch (error) {
                    console.log(`\n========== 账户 ${i + 1} | ${userDetail.first_name} ==========`);
                    console.log(`错误 proxy: ${error.message}. 继续下一个账户`);
                }
                
                await this.sleep(1000); 
            }
    
            if (minRemainingTime < Infinity) {
                const remainingDuration = Duration.fromMillis(minRemainingTime * 60 * 1000);
                const remainingSeconds = remainingDuration.as('seconds');
                await this.Countdown(remainingSeconds); 
            } else {
                await this.Countdown(10 * 60);
            }
        }
    }
}    

const bot = new BananaBot();
bot.main();