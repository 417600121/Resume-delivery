<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { Clock3, X } from 'lucide-vue-next';
import {
  formatDateTime,
  statusClass,
  statusScheduleForRecord,
  submittedTimeForRecord,
} from '../lib/data.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  metric: { type: Object, default: null },
  records: { type: Array, default: () => [] },
});

const emit = defineEmits(['close']);
const clock = ref(Date.now());
const timeFilter = ref('upcoming');
let clockTimer;

const metricTitle = computed(() => props.metric?.label || '统计');
const supportsTimeFilter = computed(() => Boolean(props.metric?.timeStatus));
const recordEntries = computed(() => props.records.map((record) => ({
  record,
  schedule: supportsTimeFilter.value
    ? statusScheduleForRecord(record, props.metric.timeStatus, clock.value)
    : null,
})));
const timeFilterCounts = computed(() => recordEntries.value.reduce(
  (counts, { schedule }) => {
    if (schedule?.bucket === 'upcoming') counts.upcoming += 1;
    else counts.past += 1;
    return counts;
  },
  { upcoming: 0, past: 0 },
));
const orderedEntries = computed(() => {
  const entries = [...recordEntries.value];
  if (!supportsTimeFilter.value) {
    return entries.sort((a, b) => compareSubmittedRecords(a.record, b.record));
  }

  return entries
    .filter(({ schedule }) => schedule.bucket === timeFilter.value)
    .sort(compareStatusSchedules);
});
const modalSubtitle = computed(() => {
  if (!supportsTimeFilter.value) {
    return `共 ${orderedEntries.value.length} 条，按投递时间从早到晚排列`;
  }

  return timeFilter.value === 'upcoming'
    ? `倒计时中 ${orderedEntries.value.length} 条，按剩余时间从短到长排列`
    : `已过去 ${orderedEntries.value.length} 条，按结束时间从近到远排列`;
});

watch(
  () => props.open,
  (open) => {
    window.clearInterval(clockTimer);
    clockTimer = undefined;
    if (!open) return;
    clock.value = Date.now();
    clockTimer = window.setInterval(() => { clock.value = Date.now(); }, 60_000);
  },
  { immediate: true },
);

watch(
  [() => props.open, () => props.metric?.key],
  ([open]) => {
    if (open) timeFilter.value = 'upcoming';
  },
  { immediate: true },
);

onUnmounted(() => window.clearInterval(clockTimer));

function submittedTimestamp(record) {
  const timestamp = new Date(submittedTimeForRecord(record)).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function compareSubmittedRecords(a, b) {
  const aTime = submittedTimestamp(a);
  const bTime = submittedTimestamp(b);
  if (aTime !== bTime) return aTime - bTime;
  return compareRecordIdentity(a, b);
}

function compareStatusSchedules(a, b) {
  const aHasTime = Number.isFinite(a.schedule.time);
  const bHasTime = Number.isFinite(b.schedule.time);
  if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
  if (aHasTime && a.schedule.time !== b.schedule.time) {
    return timeFilter.value === 'upcoming'
      ? a.schedule.time - b.schedule.time
      : b.schedule.time - a.schedule.time;
  }
  return compareRecordIdentity(a.record, b.record);
}

function compareRecordIdentity(a, b) {
  return String(a.company || '').localeCompare(String(b.company || ''), 'zh-CN')
    || String(a.position || '').localeCompare(String(b.position || ''), 'zh-CN');
}

function elapsedLabel(record) {
  const timestamp = submittedTimestamp(record);
  if (!Number.isFinite(timestamp)) return '投递时间未知';

  const elapsedMinutes = Math.floor(Math.max(0, clock.value - timestamp) / 60_000);
  if (clock.value < timestamp) return '投递时间在未来';
  if (elapsedMinutes < 1) return '刚刚投递';
  if (elapsedMinutes < 60) return `已投递 ${elapsedMinutes} 分钟`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `已投递 ${elapsedHours} 小时`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return `已投递 ${elapsedDays} 天`;

  const elapsedMonths = Math.floor(elapsedDays / 30);
  const remainingDays = elapsedDays % 30;
  return remainingDays
    ? `已投递 ${elapsedMonths} 个月 ${remainingDays} 天`
    : `已投递 ${elapsedMonths} 个月`;
}

function submittedLabel(record) {
  return formatDateTime(submittedTimeForRecord(record));
}

function scheduleCountdownLabel(schedule) {
  if (!schedule?.hasKnownTime) return '时间未设置';

  const totalMinutes = Math.floor(Math.abs(schedule.time - clock.value) / 60_000);
  if (totalMinutes < 1) return schedule.bucket === 'upcoming' ? '还有不到 1 分钟' : '刚刚过去';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const duration = [
    days ? `${days} 天` : '',
    hours ? `${hours} 小时` : '',
    minutes || (!days && !hours) ? `${minutes} 分钟` : '',
  ].filter(Boolean).join(' ');
  return schedule.bucket === 'upcoming' ? `还有 ${duration}` : `已过去 ${duration}`;
}

function scheduleDateLabel(schedule) {
  return schedule?.hasKnownTime ? formatDateTime(schedule.time) : '当前状态没有设置时间';
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
      <section
        class="modal metric-records-modal"
        :class="{ 'metric-records-modal--time-filter': supportsTimeFilter }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-records-modal-title"
      >
        <header class="modal-head">
          <div>
            <h3 id="metric-records-modal-title">{{ metricTitle }}记录</h3>
            <p class="modal-subtitle">{{ modalSubtitle }}</p>
          </div>
          <button
            type="button"
            class="modal-close"
            title="关闭"
            aria-label="关闭统计记录弹窗"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </header>

        <div v-if="supportsTimeFilter" class="metric-time-filter-bar">
          <div
            class="metric-time-filter"
            :class="{ 'is-past': timeFilter === 'past' }"
            role="group"
            aria-label="按倒计时状态筛选"
          >
            <span class="metric-time-filter-indicator" aria-hidden="true"></span>
            <button
              type="button"
              :class="{ active: timeFilter === 'upcoming' }"
              :aria-pressed="timeFilter === 'upcoming'"
              @click="timeFilter = 'upcoming'"
            >
              倒计时中 {{ timeFilterCounts.upcoming }}
            </button>
            <button
              type="button"
              :class="{ active: timeFilter === 'past' }"
              :aria-pressed="timeFilter === 'past'"
              @click="timeFilter = 'past'"
            >
              已过去 {{ timeFilterCounts.past }}
            </button>
          </div>
        </div>

        <div v-if="orderedEntries.length" class="metric-record-list" role="list">
          <article
            v-for="{ record, schedule } in orderedEntries"
            :key="record.id"
            class="metric-record-item"
            role="listitem"
          >
            <div class="metric-record-identity">
              <strong>{{ record.company || '未填写公司' }}</strong>
              <span>{{ record.position || '未填写职位' }}</span>
            </div>
            <span class="tag metric-record-status" :class="statusClass(record.status)">
              {{ record.status || '未知状态' }}
            </span>
            <div class="metric-record-age">
              <template v-if="supportsTimeFilter">
                <strong
                  :class="{
                    'is-upcoming': schedule.bucket === 'upcoming',
                    'is-unknown': !schedule.hasKnownTime,
                  }"
                >
                  <Clock3 :size="15" />{{ scheduleCountdownLabel(schedule) }}
                </strong>
                <span>{{ scheduleDateLabel(schedule) }}</span>
              </template>
              <template v-else>
                <strong><Clock3 :size="15" />{{ elapsedLabel(record) }}</strong>
                <span>{{ submittedLabel(record) }}</span>
              </template>
            </div>
          </article>
        </div>
        <div v-else class="metric-record-empty">
          <template v-if="supportsTimeFilter">
            <strong>{{ timeFilter === 'upcoming' ? '暂无倒计时中的记录' : '暂无已过去的记录' }}</strong>
            <span>
              {{ timeFilter === 'upcoming'
                ? '当前没有尚未到达的安排。'
                : '当前没有已经结束的安排。' }}
            </span>
          </template>
          <template v-else>
            <strong>暂无{{ metricTitle }}记录</strong>
            <span>当前统计卡片没有可展示的公司和职位。</span>
          </template>
        </div>

        <footer class="modal-actions">
          <button type="button" class="button primary" @click="emit('close')">关闭</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
