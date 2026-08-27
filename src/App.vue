<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  BriefcaseBusiness,
  Download,
  LayoutList,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  Upload,
  UserRound,
  X,
} from 'lucide-vue-next';
import HistoryModal from './components/HistoryModal.vue';
import MarkdownModal from './components/MarkdownModal.vue';
import MetricRecordsModal from './components/MetricRecordsModal.vue';
import OptionsModal from './components/OptionsModal.vue';
import PersonalInfoPanel from './components/PersonalInfoPanel.vue';
import RecordModal from './components/RecordModal.vue';
import RecordTable from './components/RecordTable.vue';
import SelectMenu from './components/SelectMenu.vue';
import {
  applicationTimeForRecord,
  clone,
  historyFromRecord,
  interviewsFromHistory,
  loadState,
  normalizeHistory,
  normalizePersonalInfo,
  normalizeStatusOptions,
  nowLocal,
  personalInfoItemCount,
  saveState,
  sortStatusHistory,
  statusSortRank,
  submittedTimeForRecord,
  today,
  uid,
} from './lib/data.js';

const PAGE_SIZE = 50;
const SIDEBAR_KEY = 'job-application-tracker-sidebar-collapsed';
const THEME_KEY = 'job-application-tracker-theme';
const THEME_OPTIONS = [
  { value: 'light', label: '浅色', title: '使用浅色模式', icon: Sun },
  { value: 'dark', label: '夜间', title: '使用夜间模式', icon: Moon },
  { value: 'system', label: '跟随系统', title: '跟随系统主题', icon: Monitor },
];
const SORT_OPTIONS = [
  { value: 'date-desc', label: '投递日期：新到旧' },
  { value: 'date-asc', label: '投递日期：旧到新' },
  { value: 'company', label: '公司名称' },
  { value: 'status', label: '投递状态' },
];
const loaded = loadState();

function loadSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEME_OPTIONS.some((option) => option.value === saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function systemThemeIsDark() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function normalizeRecord(record) {
  const statusHistory = historyFromRecord(record);
  return {
    company: '',
    position: '',
    source: '',
    sourceDetail: '',
    link: '',
    date: '',
    followUpDate: '',
    location: '',
    nextStep: '',
    priority: '',
    notes: '',
    ...record,
    id: record.id || uid(),
    status: statusHistory.at(-1)?.status || record.status || '已投递',
    statusHistory,
    interviews: interviewsFromHistory(statusHistory),
  };
}

const records = ref(loaded.records.map(normalizeRecord));
const options = reactive(clone(loaded.options));
const personalInfo = ref(normalizePersonalInfo(loaded.personalInfo));
const activeView = ref('records');
const search = ref('');
const statusFilter = ref('');
const sourceFilter = ref('');
const sortBy = ref('date-desc');
const page = ref(1);
const sidebarCollapsed = ref(loadSidebarCollapsed());
const themePreference = ref(loadThemePreference());
const systemPrefersDark = ref(systemThemeIsDark());
const effectiveTheme = computed(() => (
  themePreference.value === 'system'
    ? (systemPrefersDark.value ? 'dark' : 'light')
    : themePreference.value
));
const recordModalOpen = ref(false);
const historyModalOpen = ref(false);
const optionsModalOpen = ref(false);
const markdownModalOpen = ref(false);
const metricModalOpen = ref(false);
const selectedMetricKey = ref('');
const editingRecord = ref(null);
const historyRecord = ref(null);
const markdownRecord = ref(null);
const jsonImportInput = ref(null);
const jsonExportModalOpen = ref(false);
const exportPersonalInfo = ref(true);
const toast = ref('');
let toastTimer;
let systemThemeMediaQuery;

const anyModalOpen = computed(() => (
  recordModalOpen.value
  || historyModalOpen.value
  || optionsModalOpen.value
  || markdownModalOpen.value
  || metricModalOpen.value
  || jsonExportModalOpen.value
));

watch(
  [records, options, personalInfo],
  () => {
    try {
      saveState(records.value, options, personalInfo.value);
    } catch (error) {
      console.warn('无法保存求职管理数据', error);
    }
  },
  { deep: true },
);

const positionSuggestions = computed(() => uniqueValues(records.value.map((record) => record.position)));
const locationSuggestions = computed(() => uniqueValues(records.value.map((record) => record.location)));
const sourceSuggestions = computed(() => mergeSuggestions(
  options.source,
  records.value.map((record) => record.source),
));
const prioritySuggestions = computed(() => mergeSuggestions(
  options.priority,
  records.value.map((record) => record.priority),
));
const statusFilterOptions = computed(() => [
  { value: '', label: '全部状态' },
  ...options.status.map((item) => ({ value: item, label: item })),
]);
const sourceFilterOptions = computed(() => [
  { value: '', label: '全部来源' },
  ...sourceSuggestions.value.map((item) => ({ value: item, label: item })),
]);

const filteredRecords = computed(() => {
  const query = search.value.trim().toLowerCase();
  const list = records.value.filter((record) => {
    const historyText = normalizeHistory(record.statusHistory)
      .flatMap((node) => [node.status, node.at, node.note, node.round, node.link])
      .join(' ');
    const haystack = [
      record.company,
      record.position,
      record.source,
      record.sourceDetail,
      record.link,
      record.location,
      record.nextStep,
      record.notes,
      historyText,
    ].join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (!statusFilter.value || record.status === statusFilter.value)
      && (!sourceFilter.value || record.source === sourceFilter.value);
  });

  return list.sort((a, b) => {
    if (sortBy.value === 'date-asc') {
      return compareRecordsByDateAndStatus(a, b, 'asc');
    }
    if (sortBy.value === 'company') return String(a.company).localeCompare(String(b.company), 'zh-CN');
    if (sortBy.value === 'status') {
      return statusSortRank(a.status) - statusSortRank(b.status)
        || String(a.status).localeCompare(String(b.status), 'zh-CN');
    }
    return compareRecordsByDateAndStatus(a, b, 'desc');
  });
});

function compareRecordsByDateAndStatus(a, b, direction) {
  const aClosed = statusSortRank(a.status) >= 80;
  const bClosed = statusSortRank(b.status) >= 80;
  if (aClosed !== bClosed) return aClosed ? 1 : -1;

  const aTime = new Date(applicationTimeForRecord(a)).getTime();
  const bTime = new Date(applicationTimeForRecord(b)).getTime();
  const aHasTime = Number.isFinite(aTime);
  const bHasTime = Number.isFinite(bTime);
  if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
  if (aHasTime && aTime !== bTime) return direction === 'asc' ? aTime - bTime : bTime - aTime;
  return statusSortRank(a.status) - statusSortRank(b.status)
    || String(a.company).localeCompare(String(b.company), 'zh-CN');
}

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / PAGE_SIZE)));
const pageRecords = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return filteredRecords.value.slice(start, start + PAGE_SIZE);
});

watch([search, statusFilter, sourceFilter, sortBy], () => { page.value = 1; });
watch(pageCount, (count) => { if (page.value > count) page.value = count; });
watch(sidebarCollapsed, (collapsed) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  } catch {
    // The layout still works when browser storage is unavailable.
  }
});

watch(themePreference, (preference) => {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    // The theme still applies when browser storage is unavailable.
  }
});

watch(effectiveTheme, (theme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}, { immediate: true });

watch(anyModalOpen, (open) => {
  document.documentElement.classList.toggle('modal-open', open);
  document.body.classList.toggle('modal-open', open);
}, { immediate: true });

function updateSystemTheme(event) {
  systemPrefersDark.value = event.matches;
}

onMounted(() => {
  if (typeof window.matchMedia !== 'function') return;
  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemPrefersDark.value = systemThemeMediaQuery.matches;
  if (systemThemeMediaQuery.addEventListener) {
    systemThemeMediaQuery.addEventListener('change', updateSystemTheme);
  } else {
    systemThemeMediaQuery.addListener?.(updateSystemTheme);
  }
});

onUnmounted(() => {
  if (systemThemeMediaQuery?.removeEventListener) {
    systemThemeMediaQuery.removeEventListener('change', updateSystemTheme);
  } else {
    systemThemeMediaQuery?.removeListener?.(updateSystemTheme);
  }
  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
});

const metrics = computed(() => {
  const current = new Date();
  const sevenDaysAgo = new Date(current);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const allRecords = records.value;
  const followUpRecords = allRecords.filter(isFollowUpRecord);
  const interviewRecords = allRecords.filter((record) => record.status === '面试中');
  const offerRecords = allRecords.filter((record) => isOfferStatus(record.status));
  const recentRecords = allRecords.filter((record) => {
    const date = new Date(submittedTimeForRecord(record));
    return Number.isFinite(date.getTime()) && date >= sevenDaysAgo && date <= current;
  });

  return [
    { key: 'total', label: '总投递', value: allRecords.length, meta: '全部记录', records: allRecords },
    {
      key: 'follow-up',
      label: '待跟进',
      value: followUpRecords.length,
      meta: '需要主动推进',
      records: followUpRecords,
    },
    { key: 'interview', label: '面试中', value: interviewRecords.length, meta: '正在推进', records: interviewRecords },
    { key: 'offer', label: '已拿 Offer', value: offerRecords.length, meta: '阶段成果', records: offerRecords },
    { key: 'recent', label: '近 7 天投递', value: recentRecords.length, meta: '最近节奏', records: recentRecords },
  ];
});

const selectedMetric = computed(() => metrics.value.find((metric) => metric.key === selectedMetricKey.value) || null);
const selectedMetricRecords = computed(() => selectedMetric.value?.records || []);

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function mergeSuggestions(preferred, recorded) {
  const seen = new Set();
  return [...preferred, ...recorded]
    .map((value) => String(value || '').trim())
    .filter((value) => value && !seen.has(value) && seen.add(value));
}

function isRejectedStatus(status) {
  return /被拒绝|已拒绝|拒绝/.test(String(status || '').trim());
}

function isOfferStatus(status) {
  return /offer/i.test(String(status || '').trim());
}

function isFollowUpRecord(record) {
  return !isRejectedStatus(record.status) && !isOfferStatus(record.status);
}

function openMetricModal(metric) {
  selectedMetricKey.value = metric.key;
  metricModalOpen.value = true;
}

function closeMetricModal() {
  metricModalOpen.value = false;
  selectedMetricKey.value = '';
}

function clearFilters() {
  search.value = '';
  statusFilter.value = '';
  sourceFilter.value = '';
  sortBy.value = 'date-desc';
  page.value = 1;
  showToast('已清除搜索和筛选');
}

function showToast(message) {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.value = ''; }, 2200);
}

function openAddModal() {
  editingRecord.value = null;
  recordModalOpen.value = true;
}

function openEditModal(record) {
  editingRecord.value = record;
  recordModalOpen.value = true;
}

function saveRecord(draft) {
  const index = draft.id ? records.value.findIndex((record) => record.id === draft.id) : -1;
  const existing = index >= 0 ? records.value[index] : null;
  const statusHistory = existing ? normalizeHistory(existing.statusHistory) : [];

  if (!statusHistory.length) {
    statusHistory.push({
      id: uid(),
      status: '待投递',
      at: nowLocal(),
      note: '创建记录',
      round: '',
      link: '',
    });
  }

  const record = {
    ...existing,
    ...draft,
    id: existing?.id || uid(),
    date: existing?.date || '',
    followUpDate: '',
    sourceDetail: draft.source === '其他' ? draft.sourceDetail || '' : '',
    status: statusHistory.at(-1).status,
    statusHistory,
    interviews: interviewsFromHistory(statusHistory),
  };

  if (index >= 0) records.value[index] = record;
  else records.value.unshift(record);

  recordModalOpen.value = false;
  showToast(index >= 0 ? '记录已更新' : '记录已保存');
}

function openHistoryModal(record) {
  historyRecord.value = record;
  historyModalOpen.value = true;
}

function saveHistory(nodes) {
  const index = records.value.findIndex((record) => record.id === historyRecord.value?.id);
  if (index < 0) return;
  const statusHistory = sortStatusHistory(nodes);
  records.value[index] = {
    ...records.value[index],
    status: statusHistory.at(-1).status,
    statusHistory,
    interviews: interviewsFromHistory(statusHistory),
  };
  historyRecord.value = records.value[index];
  historyModalOpen.value = false;
  showToast('状态时间线已保存');
}

function deleteRecord(record) {
  if (!window.confirm(`确定删除“${record.company} · ${record.position}”吗？`)) return;
  records.value = records.value.filter((item) => item.id !== record.id);
  showToast('记录已删除');
}

function openMarkdownModal(record) {
  markdownRecord.value = record;
  markdownModalOpen.value = true;
}

function saveMarkdown(content) {
  const index = records.value.findIndex((record) => record.id === markdownRecord.value?.id);
  if (index < 0) return;
  records.value[index] = { ...records.value[index], link: content };
  markdownRecord.value = records.value[index];
  markdownModalOpen.value = false;
  showToast('招聘信息已保存');
}

function saveOptions(nextOptions) {
  const normalized = clone(nextOptions);
  normalized.status = normalizeStatusOptions(normalized.status);
  Object.assign(options, normalized);
  optionsModalOpen.value = false;
  showToast('选项已保存');
}

function updatePersonalInfo(groups) {
  personalInfo.value = normalizePersonalInfo(groups);
}

function exportCsv() {
  const headers = [
    '公司名称', '职位名称', '消息来源', '来源补充', '招聘链接/备注', '投递时间', '投递状态',
    '状态时间线', '下一步计划', '工作地点', '优先级', '备注',
  ];
  const rows = records.value.map((record) => [
    record.company,
    record.position,
    record.source,
    record.sourceDetail,
    record.link,
    applicationTimeForRecord(record),
    record.status,
    normalizeHistory(record.statusHistory).map((node) => [
      node.status,
      node.round,
      node.at,
      node.note,
      node.link,
    ].filter(Boolean).join(' ')).join('；'),
    record.nextStep,
    record.location,
    record.priority,
    record.notes,
  ]);
  const csv = '\ufeff' + [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `投递记录_${today()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('CSV 已导出');
}

function openJsonExport() {
  exportPersonalInfo.value = true;
  jsonExportModalOpen.value = true;
}

function exportJson() {
  const payload = {
    format: 'job-application-tracker',
    version: 4,
    exportedAt: new Date().toISOString(),
    records: clone(records.value),
    options: clone(options),
    ...(exportPersonalInfo.value ? { personalInfo: clone(personalInfo.value) } : {}),
  };
  const url = URL.createObjectURL(new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json;charset=utf-8' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `求职管理数据_${today()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  jsonExportModalOpen.value = false;
  showToast('JSON 数据已导出');
}

function openJsonImport() {
  jsonImportInput.value?.click();
}

function normalizeImportedOptions(importedOptions) {
  if (!importedOptions || typeof importedOptions !== 'object') return null;
  const next = {};
  ['status', 'source', 'priority'].forEach((key) => {
    if (!Array.isArray(importedOptions[key])) return;
    const values = [...new Set(importedOptions[key]
      .map((value) => String(value || '').trim())
      .filter(Boolean))];
    if (values.length) next[key] = values;
  });
  if (next.status) next.status = normalizeStatusOptions(next.status);
  return next;
}

async function importJson(event) {
  const input = event.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const importedRecords = Array.isArray(payload) ? payload : payload?.records;
    if (!Array.isArray(importedRecords)) throw new Error('缺少 records 数组');
    if (importedRecords.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
      throw new Error('记录格式不正确');
    }

    const nextRecords = importedRecords.map(normalizeRecord);
    const hasPersonalInfo = !Array.isArray(payload)
      && Object.prototype.hasOwnProperty.call(payload, 'personalInfo');
    if (hasPersonalInfo && !Array.isArray(payload.personalInfo)) {
      throw new Error('个人信息格式不正确');
    }
    const nextPersonalInfo = hasPersonalInfo
      ? normalizePersonalInfo(payload.personalInfo)
      : personalInfo.value;
    const importSummary = hasPersonalInfo
      ? `${nextRecords.length} 条投递记录和 ${personalInfoItemCount(nextPersonalInfo)} 条个人信息`
      : `${nextRecords.length} 条投递记录`;
    const confirmed = window.confirm(
      `将导入 ${importSummary}并替换对应数据，是否继续？`,
    );
    if (!confirmed) return;

    records.value = nextRecords;
    if (hasPersonalInfo) personalInfo.value = nextPersonalInfo;
    const importedOptions = normalizeImportedOptions(
      Array.isArray(payload) ? null : payload.options,
    );
    if (importedOptions) Object.assign(options, importedOptions);
    search.value = '';
    statusFilter.value = '';
    sourceFilter.value = '';
    sortBy.value = 'date-desc';
    page.value = 1;
    showToast(`已导入 ${importSummary}`);
  } catch (error) {
    console.warn('无法导入 JSON 数据', error);
    window.alert(`导入失败：${error.message || '文件格式不正确'}`);
  }
}
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><BriefcaseBusiness :size="19" /></div>
        <div class="brand-copy">
          <h1>求职投递</h1>
          <p>Application Tracker</p>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="主导航">
        <button
          type="button"
          class="nav-item"
          :class="{ active: activeView === 'records' }"
          title="投递记录"
          @click="activeView = 'records'"
        >
          <LayoutList :size="18" /><span>投递记录</span>
        </button>
        <button
          type="button"
          class="nav-item"
          :class="{ active: activeView === 'personal' }"
          title="个人信息"
          @click="activeView = 'personal'"
        >
          <UserRound :size="18" /><span>个人信息</span>
        </button>
        <button
          type="button"
          class="nav-item sidebar-toggle"
          :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <PanelLeftOpen v-if="sidebarCollapsed" :size="18" />
          <PanelLeftClose v-else :size="18" />
          <span>{{ sidebarCollapsed ? '展开侧边栏' : '收起侧边栏' }}</span>
        </button>
      </nav>

      <section class="theme-settings" aria-label="主题设置">
        <div class="theme-options" role="radiogroup" aria-label="选择主题">
          <button
            v-for="theme in THEME_OPTIONS"
            :key="theme.value"
            type="button"
            class="theme-option"
            :class="{ active: themePreference === theme.value }"
            :aria-pressed="themePreference === theme.value"
            :title="theme.title"
            @click="themePreference = theme.value"
          >
            <component :is="theme.icon" :size="15" />
            <span>{{ theme.label }}</span>
          </button>
        </div>
      </section>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <div>
          <div class="eyebrow">{{ activeView === 'records' ? 'APPLICATION TRACKER' : 'PERSONAL PROFILE' }}</div>
          <h2>{{ activeView === 'records' ? '投递管理' : '个人信息' }}</h2>
          <p>{{ activeView === 'records' ? '集中管理岗位、面试安排与每一次状态变化。' : '姓名、在校、项目与实习经历的常用信息。' }}</p>
        </div>
        <div v-if="activeView === 'records'" class="top-actions">
          <div class="top-actions-secondary" aria-label="数据工具">
            <button type="button" class="button button-quiet" @click="optionsModalOpen = true">
              <Settings :size="16" />选项设置
            </button>
            <button type="button" class="button button-quiet" @click="exportCsv">
              <Download :size="16" />导出 CSV
            </button>
            <button type="button" class="button button-quiet" @click="openJsonExport">
              <Download :size="16" />导出 JSON
            </button>
            <button type="button" class="button button-quiet" @click="openJsonImport">
              <Upload :size="16" />导入 JSON
            </button>
          </div>
          <input
            ref="jsonImportInput"
            type="file"
            accept=".json,application/json"
            hidden
            @change="importJson"
          />
          <button type="button" class="button primary" @click="openAddModal">
            <Plus :size="18" />新增投递
          </button>
        </div>
      </header>

      <template v-if="activeView === 'records'">
        <section class="summary" aria-label="投递统计">
          <button
            v-for="metric in metrics"
            :key="metric.key"
            type="button"
            class="metric metric-clickable"
            :aria-label="`查看${metric.label}记录，共 ${metric.value} 条`"
            @click="openMetricModal(metric)"
          >
            <div class="metric-label">{{ metric.label }}</div>
            <div class="metric-value">{{ metric.value }}</div>
            <div class="metric-meta">{{ metric.meta }}</div>
          </button>
        </section>

        <section class="records-panel">
          <div class="toolbar">
            <div class="search-box">
              <Search :size="18" />
              <input v-model="search" placeholder="搜索公司、职位、来源、地点或备注" />
            </div>
            <SelectMenu v-model="statusFilter" class="filter-select" aria-label="按状态筛选" :options="statusFilterOptions" />
            <SelectMenu v-model="sourceFilter" class="filter-select" aria-label="按来源筛选" :options="sourceFilterOptions" />
            <SelectMenu v-model="sortBy" class="filter-select sort-select" aria-label="排序" :options="SORT_OPTIONS" />
          </div>

          <RecordTable
            :records="pageRecords"
            :filtered-count="filteredRecords.length"
            :total-count="records.length"
            :page="page"
            :page-count="pageCount"
            @add="openAddModal"
            @clear-filters="clearFilters"
            @edit="openEditModal"
            @history="openHistoryModal"
            @markdown="openMarkdownModal"
            @delete="deleteRecord"
            @page="page = $event"
          />
        </section>
      </template>

      <PersonalInfoPanel
        v-else
        :groups="personalInfo"
        @update:groups="updatePersonalInfo"
        @toast="showToast"
      />
    </main>
  </div>

  <RecordModal
    :open="recordModalOpen"
    :record="editingRecord"
    :options="options"
    :position-suggestions="positionSuggestions"
    :location-suggestions="locationSuggestions"
    :source-suggestions="sourceSuggestions"
    :priority-suggestions="prioritySuggestions"
    @close="recordModalOpen = false"
    @save="saveRecord"
  />
  <HistoryModal
    :open="historyModalOpen"
    :record="historyRecord"
    :options="options"
    @close="historyModalOpen = false"
    @save="saveHistory"
  />
  <MarkdownModal
    :open="markdownModalOpen"
    :record="markdownRecord"
    @close="markdownModalOpen = false"
    @save="saveMarkdown"
  />
  <MetricRecordsModal
    :open="metricModalOpen"
    :metric="selectedMetric"
    :records="selectedMetricRecords"
    @close="closeMetricModal"
  />
  <OptionsModal
    :open="optionsModalOpen"
    :options="options"
    @close="optionsModalOpen = false"
    @save="saveOptions"
  />

  <div v-if="jsonExportModalOpen" class="modal-backdrop" @click.self="jsonExportModalOpen = false">
    <section class="modal modal-export-json" role="dialog" aria-modal="true" aria-labelledby="json-export-title">
      <header class="modal-head">
        <h3 id="json-export-title">导出 JSON</h3>
        <button type="button" class="modal-close" title="关闭" aria-label="关闭 JSON 导出弹窗" @click="jsonExportModalOpen = false">
          <X :size="20" />
        </button>
      </header>
      <form @submit.prevent="exportJson">
        <div class="json-export-options">
          <label class="json-export-checkbox">
            <input v-model="exportPersonalInfo" type="checkbox" />
            <span>包含个人信息（{{ personalInfoItemCount(personalInfo) }} 条）</span>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="button" @click="jsonExportModalOpen = false">取消</button>
          <button type="submit" class="button primary">
            <Download :size="17" />导出
          </button>
        </div>
      </form>
    </section>
  </div>

  <Transition name="toast">
    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </Transition>
</template>
