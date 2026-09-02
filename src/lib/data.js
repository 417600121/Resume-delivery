export const STORAGE_KEY = 'job-application-tracker-v1';

export const DEFAULT_OPTIONS = {
  status: ['待投递', '已投递', '笔试中', '面试中', '待跟进', '已拿Offer', '已入职', '已拒绝', '暂不考虑'],
  source: ['BOSS直聘', '猎聘', '智联招聘', '前程无忧', '公司官网', '内推', '公众号/社群', '宣讲会/双选会', '邮件', '朋友推荐', '其他'],
  priority: ['高', '中', '低'],
};

export const INTERVIEW_ROUNDS = ['一面', '二面', '三面', '四面', 'HR面', '终面'];

export const PERSONAL_INFO_GROUPS = [
  { key: 'personal', title: '个人信息' },
  { key: 'education', title: '在校经历' },
  { key: 'projects', title: '项目经历' },
  { key: 'internships', title: '实习经历' },
];

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function today() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function nowLocal() {
  const date = new Date();
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function statusSortRank(status) {
  const normalizedStatus = String(status || '').trim();
  if (/拒绝|被拒|淘汰|不考虑|未通过|失败/.test(normalizedStatus)) return 90;
  if (/入职/.test(normalizedStatus)) return 80;
  if (/Offer/i.test(normalizedStatus)) return 70;
  if (/面试/.test(normalizedStatus)) return 40;
  if (/笔试/.test(normalizedStatus)) return 30;
  if (/待跟进/.test(normalizedStatus)) return 20;
  if (/已投递/.test(normalizedStatus)) return 10;
  if (/待投递/.test(normalizedStatus)) return 0;
  return 50;
}

export function upcomingStatusTimeForRecord(record, now = Date.now()) {
  const currentTime = Number.isFinite(now) ? now : Date.now();
  const historyTimes = normalizeHistory(record?.statusHistory)
    .map((node) => new Date(node.at).getTime())
    .filter((time) => Number.isFinite(time) && time >= currentTime);
  const interviewTimes = record?.status === '面试中'
    ? interviewsForRecord(record)
      .map((interview) => new Date(interview.date).getTime())
      .filter((time) => Number.isFinite(time) && time >= currentTime)
    : [];

  return [...historyTimes, ...interviewTimes].sort((a, b) => a - b)[0] ?? null;
}

export function sortStatusHistory(history) {
  return normalizeHistory(history)
    .map((node, index) => ({ node, index, time: new Date(node.at).getTime() }))
    .sort((a, b) => {
      const aHasTime = Number.isFinite(a.time);
      const bHasTime = Number.isFinite(b.time);
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
      if (aHasTime && a.time !== b.time) return a.time - b.time;
      const rankDifference = statusSortRank(a.node.status) - statusSortRank(b.node.status);
      return rankDifference || a.index - b.index;
    })
    .map(({ node }) => node);
}

export function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeStatusOptions(items) {
  const values = Array.isArray(items)
    ? [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
  if (!values.length) return clone(DEFAULT_OPTIONS.status);
  if (!values.includes('已拒绝')) values.push('已拒绝');
  return values;
}

function normalizePersonalInfoItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return { id: uid(), text: item.trim() };
      if (!item || typeof item !== 'object') return null;
      return { id: item.id || uid(), text: String(item.text || '').trim() };
    })
    .filter((item) => item?.text);
}

export function normalizePersonalInfo(value) {
  const defaultGroups = () => PERSONAL_INFO_GROUPS.map((group) => ({ ...group, items: [] }));
  if (!Array.isArray(value) || !value.length) return defaultGroups();

  const isGrouped = value.some((item) => item && typeof item === 'object' && Array.isArray(item.items));
  if (!isGrouped) {
    const groups = defaultGroups();
    groups[0].items = normalizePersonalInfoItems(value);
    return groups;
  }

  const keys = new Set();
  return value
    .filter((group) => group && typeof group === 'object' && !Array.isArray(group))
    .map((group, index) => {
      let key = String(group.key || group.id || '').trim();
      if (!key || keys.has(key)) key = uid();
      keys.add(key);
      return {
        key,
        title: String(group.title || '').trim() || `分组 ${index + 1}`,
        items: normalizePersonalInfoItems(group.items),
      };
    });
}

export function personalInfoItemCount(groups) {
  return normalizePersonalInfo(groups)
    .reduce((total, group) => total + group.items.length, 0);
}

export function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((node) => node?.status)
    .map((node) => ({
      id: node.id || uid(),
      status: node.status,
      at: node.at || '',
      note: node.note || '',
      round: node.round || '',
      link: node.link || '',
    }));
}

export function normalizeInterviews(interviews) {
  if (!Array.isArray(interviews)) return [];
  return interviews
    .filter((item) => item && (item.round || item.date || item.link))
    .map((item) => ({ round: item.round || '面试', date: item.date || '', link: item.link || '' }));
}

export function historyFromRecord(record) {
  const saved = sortStatusHistory(record?.statusHistory);
  if (saved.length) return saved;

  const history = [];
  if (record?.date) {
    history.push({ id: uid(), status: '已投递', at: `${record.date}T09:00`, note: '完成投递', round: '', link: '' });
  }
  normalizeInterviews(record?.interviews).forEach((item) => {
    history.push({ id: uid(), status: '面试中', at: item.date, note: '面试安排', round: item.round, link: item.link });
  });
  if (record?.status && history.at(-1)?.status !== record.status) {
    history.push({ id: uid(), status: record.status, at: '', note: '当前状态', round: '', link: '' });
  }
  return history.length
    ? history
    : [{ id: uid(), status: record?.status || '已投递', at: nowLocal(), note: '创建记录', round: '', link: '' }];
}

export function interviewsFromHistory(history) {
  return normalizeHistory(history)
    .filter((node) => node.status === '面试中' && (node.round || node.at || node.link))
    .map((node) => ({ round: node.round || '面试', date: node.at, link: node.link }));
}

export function interviewsForRecord(record) {
  const fromHistory = interviewsFromHistory(record?.statusHistory);
  return fromHistory.length ? fromHistory : normalizeInterviews(record?.interviews);
}

export function applicationTimeForRecord(record) {
  const submitted = submittedTimeForRecord(record);
  if (submitted) return submitted;

  const history = normalizeHistory(record?.statusHistory);

  const currentStatus = [...history]
    .reverse()
    .find((node) => node.status === record?.status && node.at);
  if (currentStatus) return currentStatus.at;

  return history.length || !record?.date ? '' : `${record.date}T00:00`;
}

export function submittedTimeForRecord(record) {
  const submitted = sortStatusHistory(record?.statusHistory)
    .filter((node) => node.status === '已投递' && node.at)
    .at(-1);
  if (submitted) return submitted.at;

  return record?.date ? `${record.date}T00:00` : '';
}

export function applicationStatusQueryLink(record) {
  return sortStatusHistory(record?.statusHistory)
    .filter((node) => node.status === '已投递' && String(node.link || '').trim())
    .at(-1)?.link.trim() || '';
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.records)) {
      return {
        records: saved.records.map((record) => ({ ...record, id: record.id || uid() })),
        options: {
          status: normalizeStatusOptions(saved.options?.status),
          source: Array.isArray(saved.options?.source) ? saved.options.source : clone(DEFAULT_OPTIONS.source),
          priority: Array.isArray(saved.options?.priority) ? saved.options.priority : clone(DEFAULT_OPTIONS.priority),
        },
        personalInfo: normalizePersonalInfo(saved.personalInfo),
      };
    }
  } catch (error) {
    console.warn('无法读取已有投递数据', error);
  }
  return { records: [], options: clone(DEFAULT_OPTIONS), personalInfo: normalizePersonalInfo([]) };
}

export function saveState(records, options, personalInfo = []) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, options, personalInfo }));
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}

export function isWebLink(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function statusClass(status) {
  const normalizedStatus = String(status || '').trim();
  if (normalizedStatus.includes('拒绝')) return 'reject';

  return {
    待投递: 'wait',
    已投递: 'sent',
    笔试中: 'test',
    面试中: 'interview',
    待跟进: 'follow',
    已拿Offer: 'offer',
    已入职: 'joined',
    暂不考虑: 'wait',
  }[normalizedStatus] || 'sent';
}
