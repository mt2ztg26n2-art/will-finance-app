/* =========================================================
   Parsers — 智能解析文字/语音记账
   支持: 类型(收入/支出/转账)、金额、账户、分类、对方、地点
   ========================================================= */

const Parser = (() => {

  // 解析金额
  function parseAmount(text) {
    // 优先匹配 带"块"或者"千"等单位
    const wanMatch = text.match(/(\d+(?:\.\d+)?)\s*[万千wWkK]/);
    if (wanMatch) {
      let n = parseFloat(wanMatch[1]);
      const unit = wanMatch[0].match(/[万千]/);
      if (unit && unit[0] === '万') n *= 10000;
      else if (unit && unit[0] === '千') n *= 1000;
      else if (/[wW]/.test(wanMatch[0])) n *= 10000;
      else if (/[kK]/.test(wanMatch[0])) n *= 1000;
      return { amount: n, raw: wanMatch[0] };
    }
    const m = text.match(/(?:¥|￥|rmb|RMB)?\s*(\d+(?:\.\d+)?)\s*(?:块|元|RMB|rmb|圆)?/);
    if (m) return { amount: parseFloat(m[1]), raw: m[0] };
    return null;
  }

  // 判断交易类型
  function parseType(text) {
    // 收入优先(必须在转账之前, 因"收到…转账"实为收款)
    if (/收入|收到|到账|入账|回款|尾款|工资|奖金|营收|劳务费|创业收入|接单/.test(text)) return 'income';
    // 转账
    if (/转账|转给|转入|转到|打给|转.{0,4}(?:账户|卡)|从.{0,8}转/.test(text)) return 'transfer';
    if (/花了|支出|付了|买|购|订|缴|还|充值|打车|吃饭|买书|买教材|消费|开销|花掉/.test(text)) return 'expense';
    // 默认为支出
    if (parseAmount(text)) return 'expense';
    return 'expense';
  }

  // 解析账户
  function parseAccount(text, accounts) {
    if (!accounts || !accounts.length) return null;
    // 关键词匹配
    const map = [
      { keys: ['招商', '招行', 'cmb', 'CMB'], hint: '招商' },
      { keys: ['建设', '建行', 'ccb', 'CCB'], hint: '建设' },
      { keys: ['工商', '工行', 'icbc', 'ICBC'], hint: '工商' },
      { keys: ['中国银行', '中行', 'boc', 'BOC'], hint: '中国银行' },
      { keys: ['交通银行', '交行'], hint: '交通' },
      { keys: ['农业银行', '农行'], hint: '农业' },
      { keys: ['邮政', '邮储'], hint: '邮政' },
      { keys: ['支付宝', 'alipay', '宝'], hint: '支付宝' },
      { keys: ['微信', 'wechat', 'vx', 'VX'], hint: '微信' },
      { keys: ['现金'], hint: '现金' },
      { keys: ['创业', '储备', '公司'], hint: '创业' },
    ];
    for (const m of map) {
      for (const k of m.keys) {
        if (text.toLowerCase().includes(k.toLowerCase())) {
          const acc = accounts.find(a => a.name.includes(m.hint));
          if (acc) return acc;
        }
      }
    }
    return null;
  }

  // 解析分类 - 基于关键词
  function parseCategory(text, type, categories) {
    if (!categories) return null;
    const targetCats = categories.filter(c => c.type === type || c.type === 'all');

    const keywordMap = [
      { keys: ['外卖'], cat: '外卖' },
      { keys: ['食堂', '饭', '餐', '吃', '喝', '咖啡', '奶茶', '午饭', '晚饭', '早饭'], cat: '早午晚餐' },
      { keys: ['地铁', '公交'], cat: '地铁' },
      { keys: ['打车', '滴滴', '出租'], cat: '网约车' },
      { keys: ['高铁', '火车'], cat: '火车票' },
      { keys: ['飞机', '机票'], cat: '机票' },
      { keys: ['油费'], cat: '油费' },
      { keys: ['洗发水', '牙膏', '纸巾', '洗衣液', '日用'], cat: '洗护用品' },
      { keys: ['电影', '演唱会', 'KTV', 'ktv', '剧本杀', '密室', '娱乐'], cat: '电影演出' },
      { keys: ['游戏'], cat: '游戏' },
      { keys: ['话费', '流量', '通讯'], cat: '话费' },
      { keys: ['网费', '宽带'], cat: '网费' },
      { keys: ['学费', '学杂', '缴费', '报名'], cat: '课程费' },
      { keys: ['书', '教材', '资料', '打印', '复印'], cat: '教材' },
      { keys: ['培训', '考证', '课程', '网课'], cat: '考证' },
      { keys: ['签证', '护照', '留学', '申请费'], cat: '申请费' },
      { keys: ['电脑', '笔记本', '手机', '设备', '硬件', '键盘', '鼠标', '显示器'], cat: '硬件' },
      { keys: ['差旅', '酒店', '住宿', '宾馆', '出差'], cat: '住宿' },
      { keys: ['外包', '设计', '代做'], cat: '设计外包' },
      { keys: ['广告', '推广', '营销', '投放', 'SEO'], cat: '广告投放' },
      { keys: ['花呗', '还款'], cat: '花呗' },
      { keys: ['信用卡'], cat: '信用卡' },
      { keys: ['父母', '生活费', '家里', '爸妈'], cat: '父母生活费' },
      { keys: ['项目', '尾款', '客户', '创业收入', '接单'], cat: '创业收入' },
      { keys: ['兼职', '家教', '翻译', '代写'], cat: '家教' },
      { keys: ['奖学', '奖金'], cat: '奖学金' },
    ];

    for (const km of keywordMap) {
      for (const k of km.keys) {
        if (text.includes(k)) {
          const cat = targetCats.find(c => c.name === km.cat);
          if (cat) return cat;
        }
      }
    }
    return targetCats[0] || null;
  }

  // 解析地点
  function parseLocation(text) {
    const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '重庆', '天津', '苏州', '厦门', '青岛', '长沙', '郑州', '合肥', '福州', '济南', '南昌', '昆明', '石家庄', '太原', '南宁', '贵阳', '兰州', '银川', '西宁', '乌鲁木齐', '拉萨', '海口', '三亚', '哈尔滨', '长春', '沈阳', '大连', '香港', '澳门', '台北', '新加坡', '东京', '首尔', '纽约', '伦敦', '巴黎', '柏林', '悉尼', '墨尔本'];
    for (const city of cities) {
      if (text.includes(city)) return city;
    }
    return '';
  }

  // 解析对方/商家
  function parsePayee(text, type, account) {
    // 优先匹配 "在/往/向 + 商家 + 动作" 模式 (如: 在XX书店买)
    const merchantMatch = text.match(/(?:在|往|向)\s*([\u4e00-\u9fa5a-zA-Z0-9·\u00b7]{2,10}?)(?:买|花|付|吃|消费|订|购|充值|打了?|住|看|玩|还|缴)/);
    if (merchantMatch && merchantMatch[1].length >= 2) return merchantMatch[1];

    let cleaned = text
      .replace(/(今天|刚才|昨天|前天|前两天|今早|今晚|凌晨|上午|下午|中午)/g, '')
      .replace(/\d+(?:\.\d+)?\s*[万千wWkK]?/g, '')
      .replace(/(¥|￥|rmb|RMB|块|元|圆)/g, '')
      .replace(/(花了|支出|付了|买|购|订|缴|还|充值|收到|转账|转入|转给|转到|用了?|从|在|于|通过|给|向|往|去|到|打车)/g, ' ');

    // 移除已识别账户名, 避免污染对方字段
    if (account && account.name) {
      cleaned = cleaned.split(account.name).join(' ');
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 提取 2-10 字符的 名词性短语
    const m = cleaned.match(/[\u4e00-\u9fa5a-zA-Z0-9·\u00b7]{2,10}/);
    return m ? m[0] : (type === 'income' ? '收入来源' : '支出对象');
  }

  // 主解析函数
  function parse(text, ctx = {}) {
    const accounts = ctx.accounts || [];
    const categories = ctx.categories || [];

    const result = {
      raw: text,
      type: parseType(text),
      amount: null,
      account: null,
      toAccount: null,
      category: null,
      payee: '',
      location: '',
      description: text,
      time: Date.now(),
    };

    // 金额
    const amtResult = parseAmount(text);
    if (amtResult) {
      result.amount = amtResult.amount;
    } else {
      result.amount = 0;
    }

    // 分类
    result.category = parseCategory(text, result.type, categories);

    // 账户
    result.account = parseAccount(text, accounts);
    if (!result.account && result.type !== 'transfer') {
      // 默认使用第一个非创业账户,或者第一个账户
      result.account = accounts.find(a => a.type !== 'business' && a.type !== 'liability') || accounts[0] || null;
    }

    // 转账目标
    if (result.type === 'transfer') {
      result.toAccount = accounts.find(a => a.id !== (result.account && result.account.id) && a.type === 'business')
        || accounts.find(a => a.id !== (result.account && result.account.id))
        || accounts[1] || null;
    }

    // 对方
    result.payee = parsePayee(text, result.type, result.account);

    // 地点
    result.location = parseLocation(text);

    return result;
  }

  return { parse };
})();
