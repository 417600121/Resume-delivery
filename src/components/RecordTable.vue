<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  History,
  Pencil,
  Trash2,
} from 'lucide-vue-next';
import {
  applicationStatusQueryLink,
  applicationTimeForRecord,
  formatDateTime,
  interviewsForRecord,
  isWebLink,
  normalizeHistory,
  statusClass,
} from '../lib/data.js';
import { firstMarkdownLink, renderMarkdown } from '../lib/markdown.js';

const props = defineProps({
  records: { type: Array, default: () => [] },
  filteredCount: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageCount: { type: Number, default: 1 },
});

const emit = defineEmits(['add', 'edit', 'history', 'markdown', 'delete', 'page']);
const clock = ref(Date.now());
const noteTooltip = ref(null);
const noteTooltipElement = ref(null);
const recruitmentTooltip = ref(null);
const recruitmentTooltipElement = ref(null);
let clockTimer;
let noteTooltipTimer;
let recruitmentTooltipTimer;

onMounted(() => {
  clockTimer = window.setInterval(() => { clock.value = Date.now(); }, 30_000);
});

onUnmounted(() => {
  window.clearInterval(clockTimer);
  window.clearTimeout(noteTooltipTimer);
  window.clearTimeout(recruitmentTooltipTimer);
});

const recordRows = computed(() => props.records.map((record) => {
  const now = clock.value;
  const history = normalizeHistory(record.statusHistory);
  const currentNode = selectStatusNode(history, record.status, now);
  const legacyInterview = record.status === '面试中' && !currentNode?.at
    ? selectNearestInterview(interviewsForRecord(record), now)
    : null;
  const statusEvent = currentNode?.at
    ? {
        status: currentNode.status,
        label: currentNode.round || currentNode.status,
        date: currentNode.at,
        note: currentNode.note,
        link: currentNode.link,
      }
    : legacyInterview
      ? {
          status: '面试中',
          label: legacyInterview.round || '面试',
          date: legacyInterview.date,
          note: '',
          link: legacyInterview.link,
        }
      : null;

  const statusQueryLink = applicationStatusQueryLink(record);
  let actionLink = record.status === '已投递' ? '' : currentNode?.link || '';
  if (record.status === '待投递') {
    const recruitmentLink = firstMarkdownLink(record.link);
    if (!isWebLink(actionLink) && recruitmentLink) actionLink = recruitmentLink;
  }
  if (!actionLink) actionLink = statusEvent?.link || '';

  return {
    record,
    statusEvent,
    statusQueryLink,
    actionLink,
    actionLabel: {
      待投递: '打开投递链接',
      笔试中: '打开笔试链接',
      面试中: '打开面试链接',
    }[record.status] || '打开相关链接',
  };
}));

function selectStatusNode(history, status, now) {
  const matches = history.filter((node) => node.status === status);
  if (!matches.length) return null;

  const timed = matches
    .map((node) => ({ node, time: new Date(node.at).getTime() }))
    .filter((item) => !Number.isNaN(item.time));
  const upcoming = timed
    .filter((item) => item.time >= now)
    .sort((a, b) => a.time - b.time);
  if (upcoming.length) return upcoming[0].node;

  return timed.sort((a, b) => b.time - a.time)[0]?.node || matches.at(-1);
}

function selectNearestInterview(interviews, now) {
  const timed = interviews
    .map((interview) => ({ interview, time: new Date(interview.date).getTime() }))
    .filter((item) => !Number.isNaN(item.time));
  const upcoming = timed
    .filter((item) => item.time >= now)
    .sort((a, b) => a.time - b.time);
  if (upcoming.length) return upcoming[0].interview;

  return timed.sort((a, b) => b.time - a.time)[0]?.interview || interviews.at(-1) || null;
}

function sourceLabel(record) {
  return record.source === '其他' && record.sourceDetail
    ? `其他 · ${record.sourceDetail}`
    : record.source || '—';
}

function hasRecruitmentPreview(record) {
  return Boolean(String(record.link || '').trim());
}

function priorityClass(value) {
  return { 高: 'priority-high', 中: 'priority-mid', 低: 'priority-low' }[value] || 'priority-low';
}

function statusCountdown(value) {
  if (!value) return '';
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return '';

  const totalMinutes = Math.floor(Math.abs(target - clock.value) / 60_000);
  if (totalMinutes < 1) return target >= clock.value ? '还有不到 1 分钟' : '刚刚过去';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const suffix = [
    days ? `${days} 天` : '',
    hours ? `${hours} 小时` : '',
    `${minutes} 分钟`,
  ].filter(Boolean).join(' ');
  return target >= clock.value ? `还有 ${suffix}` : `已过去 ${suffix}`;
}

function showNoteTooltip(event, text) {
  window.clearTimeout(noteTooltipTimer);
  window.clearTimeout(recruitmentTooltipTimer);
  recruitmentTooltip.value = null;
  const anchor = event.currentTarget;
  const anchorRect = anchor.getBoundingClientRect();
  noteTooltip.value = { text, left: anchorRect.left, top: anchorRect.bottom + 8 };
  positionTooltip(noteTooltip, noteTooltipElement, anchorRect);
}

function positionTooltip(tooltip, tooltipElement, anchorRect) {
  nextTick(() => {
    if (!tooltip.value || !tooltipElement.value) return;
    const tooltipRect = tooltipElement.value.getBoundingClientRect();
    const pagePadding = 12;
    const gap = 8;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - pagePadding,
      Math.max(pagePadding, anchorRect.left + (anchorRect.width - tooltipRect.width) / 2),
    );
    const below = anchorRect.bottom + gap;
    const top = below + tooltipRect.height <= window.innerHeight - pagePadding
      ? below
      : Math.max(pagePadding, anchorRect.top - tooltipRect.height - gap);
    tooltip.value = { ...tooltip.value, left, top };
  });
}

function keepNoteTooltip() {
  window.clearTimeout(noteTooltipTimer);
}

function hideNoteTooltip() {
  window.clearTimeout(noteTooltipTimer);
  noteTooltipTimer = window.setTimeout(() => {
    noteTooltip.value = null;
  }, 120);
}

function showRecruitmentTooltip(event, record) {
  if (!hasRecruitmentPreview(record)) return;
  window.clearTimeout(recruitmentTooltipTimer);
  window.clearTimeout(noteTooltipTimer);
  noteTooltip.value = null;
  const anchor = event.currentTarget;
  const anchorRect = anchor.getBoundingClientRect();
  recruitmentTooltip.value = {
    html: renderMarkdown(record.link),
    left: anchorRect.left,
    top: anchorRect.bottom + 8,
  };
  positionTooltip(recruitmentTooltip, recruitmentTooltipElement, anchorRect);
}

function keepRecruitmentTooltip() {
  window.clearTimeout(recruitmentTooltipTimer);
}

function hideRecruitmentTooltip() {
  window.clearTimeout(recruitmentTooltipTimer);
  recruitmentTooltipTimer = window.setTimeout(() => {
    recruitmentTooltip.value = null;
  }, 120);
}
</script>

<template>
  <div v-if="records.length" class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="company-column">公司 / 职位</th>
          <th>来源 / 招聘信息</th>
          <th class="application-time-column">投递时间</th>
          <th>当前状态</th>
          <th>下一步 / 链接</th>
          <th>地点</th>
          <th>优先级</th>
          <th class="actions-column">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="{ record, statusEvent, statusQueryLink, actionLink, actionLabel } in recordRows" :key="record.id">
          <td class="company-column">
            <div class="company">{{ record.company }}</div>
            <div class="position">{{ record.position }}</div>
          </td>
          <td>
            <div>{{ sourceLabel(record) }}</div>
            <button
              type="button"
              class="markdown-entry-button"
              :class="{ 'has-recruitment-preview': hasRecruitmentPreview(record) }"
              @click="emit('markdown', record)"
              @mouseenter="showRecruitmentTooltip($event, record)"
              @mouseleave="hideRecruitmentTooltip"
              @focus="showRecruitmentTooltip($event, record)"
              @blur="hideRecruitmentTooltip"
            >
              <FileText :size="15" />{{ record.link ? '招聘信息' : '添加信息' }}
            </button>
            <a
              v-if="isWebLink(statusQueryLink)"
              class="application-status-query-button"
              :href="statusQueryLink"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink :size="15" />查询官网状态
            </a>
          </td>
          <td class="application-time-cell application-time-column">
            <div>{{ formatDateTime(applicationTimeForRecord(record)) }}</div>
          </td>
          <td>
            <span class="tag" :class="statusClass(record.status)">{{ record.status }}</span>
            <div class="cell-note">{{ record.statusHistory?.length || 0 }} 个节点</div>
          </td>
          <td>
            <div v-if="record.nextStep" class="next-step">{{ record.nextStep }}</div>
            <template v-if="statusEvent">
              <div class="status-event-summary">
                {{ statusEvent.label }} · {{ formatDateTime(statusEvent.date) }}
              </div>
              <div
                v-if="statusCountdown(statusEvent.date)"
                class="status-event-countdown"
                :class="new Date(statusEvent.date).getTime() >= clock ? 'upcoming' : 'past'"
              >
                {{ statusCountdown(statusEvent.date) }}
              </div>
              <div
                v-if="statusEvent.note"
                class="status-event-note"
                tabindex="0"
                aria-label="查看完整节点备注"
                @mouseenter="showNoteTooltip($event, statusEvent.note)"
                @mouseleave="hideNoteTooltip"
                @focus="showNoteTooltip($event, statusEvent.note)"
                @blur="hideNoteTooltip"
              >
                {{ statusEvent.note }}
              </div>
            </template>
            <a
              v-if="isWebLink(actionLink)"
              class="interview-open-button table-interview-button"
              :href="actionLink"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink :size="16" />{{ actionLabel }}
            </a>
            <div v-else-if="actionLink" class="cell-note">{{ actionLink }}</div>
            <span v-if="!record.nextStep && !statusEvent && !actionLink" class="muted">—</span>
          </td>
          <td class="location-cell">{{ record.location || '—' }}</td>
          <td class="priority-cell"><span :class="priorityClass(record.priority)">{{ record.priority || '—' }}</span></td>
          <td>
            <div class="row-actions">
              <button type="button" class="action-button history-action" title="修改投递状态" @click="emit('history', record)">
                <History :size="16" />修改状态
              </button>
              <button type="button" class="icon-button" title="编辑记录" @click="emit('edit', record)">
                <Pencil :size="16" />
              </button>
              <button type="button" class="icon-button danger" title="删除记录" @click="emit('delete', record)">
                <Trash2 :size="16" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-else class="empty-state">
    <strong>{{ filteredCount ? '当前页没有记录' : '还没有匹配的投递记录' }}</strong>
    <p>新增一条记录，或调整当前筛选条件。</p>
    <button type="button" class="button primary" @click="emit('add')">新增投递</button>
  </div>

  <footer v-if="filteredCount" class="pagination">
    <span>共 {{ filteredCount }} 条</span>
    <div class="pagination-actions">
      <button type="button" class="icon-button" title="上一页" :disabled="page <= 1" @click="emit('page', page - 1)">
        <ChevronLeft :size="17" />
      </button>
      <span>第 {{ page }} / {{ pageCount }} 页</span>
      <button type="button" class="icon-button" title="下一页" :disabled="page >= pageCount" @click="emit('page', page + 1)">
        <ChevronRight :size="17" />
      </button>
    </div>
  </footer>

  <Teleport to="body">
    <div
      v-if="noteTooltip"
      ref="noteTooltipElement"
      class="status-note-tooltip"
      role="tooltip"
      :style="{ left: `${noteTooltip.left}px`, top: `${noteTooltip.top}px` }"
      @mouseenter="keepNoteTooltip"
      @mouseleave="hideNoteTooltip"
    >
      {{ noteTooltip.text }}
    </div>

    <div
      v-if="recruitmentTooltip"
      ref="recruitmentTooltipElement"
      class="recruitment-preview-tooltip"
      role="tooltip"
      :style="{ left: `${recruitmentTooltip.left}px`, top: `${recruitmentTooltip.top}px` }"
      @mouseenter="keepRecruitmentTooltip"
      @mouseleave="hideRecruitmentTooltip"
    >
      <div class="recruitment-preview-tooltip-head">
        <FileText :size="16" />招聘信息预览
      </div>
      <div class="recruitment-preview-tooltip-content" v-html="recruitmentTooltip.html"></div>
    </div>
  </Teleport>
</template>
