<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { Clock3, X } from 'lucide-vue-next';
import { formatDateTime, statusClass, submittedTimeForRecord } from '../lib/data.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  metric: { type: Object, default: null },
  records: { type: Array, default: () => [] },
});

const emit = defineEmits(['close']);
const clock = ref(Date.now());
let clockTimer;

const metricTitle = computed(() => props.metric?.label || '统计');
const orderedRecords = computed(() => [...props.records].sort((a, b) => {
  const aTime = submittedTimestamp(a);
  const bTime = submittedTimestamp(b);
  if (aTime !== bTime) return aTime - bTime;
  return String(a.company || '').localeCompare(String(b.company || ''), 'zh-CN');
}));

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

onUnmounted(() => window.clearInterval(clockTimer));

function submittedTimestamp(record) {
  const timestamp = new Date(submittedTimeForRecord(record)).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
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
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
      <section
        class="modal metric-records-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-records-modal-title"
      >
        <header class="modal-head">
          <div>
            <h3 id="metric-records-modal-title">{{ metricTitle }}记录</h3>
            <p class="modal-subtitle">
              共 {{ orderedRecords.length }} 条，按投递时间从早到晚排列
            </p>
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

        <div v-if="orderedRecords.length" class="metric-record-list" role="list">
          <article
            v-for="record in orderedRecords"
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
              <strong><Clock3 :size="15" />{{ elapsedLabel(record) }}</strong>
              <span>{{ submittedLabel(record) }}</span>
            </div>
          </article>
        </div>
        <div v-else class="metric-record-empty">
          <strong>暂无{{ metricTitle }}记录</strong>
          <span>当前统计卡片没有可展示的公司和职位。</span>
        </div>

        <footer class="modal-actions">
          <button type="button" class="button primary" @click="emit('close')">关闭</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
