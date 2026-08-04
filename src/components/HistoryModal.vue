<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { ExternalLink, Plus, Trash2, X } from 'lucide-vue-next';
import {
  INTERVIEW_ROUNDS,
  clone,
  formatDateTime,
  isWebLink,
  nowLocal,
  uid,
} from '../lib/data.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
  options: { type: Object, required: true },
});

const emit = defineEmits(['close', 'save']);
const draft = reactive({ nodes: [] });
const modalElement = ref(null);

const summary = computed(() => {
  if (!props.record) return '';
  return [props.record.company, props.record.position].filter(Boolean).join(' · ');
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    draft.nodes = clone(props.record?.statusHistory || []);
    if (!draft.nodes.length) {
      draft.nodes.push({
        id: uid(),
        status: props.record?.status || props.options.status[0] || '已投递',
        at: nowLocal(),
        note: '',
        round: '',
        link: '',
      });
    }
    scrollToBottom();
  },
  { immediate: true },
);

function addNode() {
  draft.nodes.push({
    id: uid(),
    status: draft.nodes.at(-1)?.status || props.options.status[0] || '已投递',
    at: nowLocal(),
    note: '',
    round: '',
    link: '',
  });
  scrollToBottom();
}

function scrollToBottom() {
  nextTick(() => {
    if (!modalElement.value) return;
    modalElement.value.scrollTop = modalElement.value.scrollHeight;
  });
}

function removeNode(index) {
  if (draft.nodes.length <= 1) return;
  draft.nodes.splice(index, 1);
}

function changeStatus(node) {
  if (node.status !== '面试中') {
    node.round = '';
  }
}

function linkFieldLabel(status) {
  return {
    待投递: '投递链接',
    笔试中: '笔试链接',
    面试中: '面试链接',
  }[status] || '相关链接';
}

function linkFieldPlaceholder(status) {
  return {
    待投递: '粘贴投递链接',
    笔试中: '粘贴笔试链接',
    面试中: '粘贴面试链接',
  }[status] || '粘贴相关链接';
}

function linkButtonLabel(status) {
  return {
    待投递: '打开投递链接',
    笔试中: '打开笔试链接',
    面试中: '打开面试链接',
  }[status] || '打开相关链接';
}

function statusOptions(node) {
  return node.status && !props.options.status.includes(node.status)
    ? [node.status, ...props.options.status]
    : props.options.status;
}

function submit() {
  const nodes = draft.nodes
    .filter((node) => node.status)
    .map((node) => ({
      id: node.id || uid(),
      status: node.status,
      at: node.at || '',
      note: node.note?.trim() || '',
      round: node.status === '面试中' ? node.round || '' : '',
      link: node.link?.trim() || '',
    }));
  if (nodes.length) emit('save', nodes);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
      <section ref="modalElement" class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
        <header class="modal-head">
          <div>
            <h3 id="history-modal-title">修改投递状态</h3>
            <p class="modal-subtitle">{{ summary }}</p>
          </div>
          <button type="button" class="modal-close" title="关闭" @click="emit('close')"><X :size="20" /></button>
        </header>

        <div class="timeline-editor">
          <div class="timeline-toolbar">
            <span>共 {{ draft.nodes.length }} 个状态节点</span>
            <button type="button" class="button compact" @click="addNode">
              <Plus :size="16" />添加节点
            </button>
          </div>

          <div class="timeline-list">
            <article v-for="(node, index) in draft.nodes" :key="node.id" class="timeline-node">
              <div class="timeline-marker" aria-hidden="true">
                <span>{{ index + 1 }}</span>
              </div>
              <div class="timeline-fields">
                <div class="field">
                  <label>状态</label>
                  <select v-model="node.status" @change="changeStatus(node)">
                    <option v-for="item in statusOptions(node)" :key="item" :value="item">{{ item }}</option>
                  </select>
                </div>
                <div class="field">
                  <label>发生时间</label>
                  <input v-model="node.at" type="datetime-local" step="900" />
                </div>
                <div v-if="node.status === '面试中'" class="field">
                  <label>面试轮次</label>
                  <select v-model="node.round">
                    <option value="">选择轮次</option>
                    <option v-for="round in INTERVIEW_ROUNDS" :key="round" :value="round">{{ round }}</option>
                  </select>
                </div>
                <div class="field timeline-note">
                  <label>节点备注</label>
                  <textarea
                    v-model.trim="node.note"
                    rows="2"
                    placeholder="可填写账号、密码、联系人、注意事项等文本"
                  ></textarea>
                </div>
                <div class="field timeline-link">
                  <label>{{ linkFieldLabel(node.status) }}</label>
                  <div class="link-field">
                    <input v-model.trim="node.link" :placeholder="linkFieldPlaceholder(node.status)" />
                    <a
                      v-if="isWebLink(node.link)"
                      class="button interview-open-button"
                      :href="node.link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink :size="17" />{{ linkButtonLabel(node.status) }}
                    </a>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="icon-button danger"
                title="删除状态节点"
                :disabled="draft.nodes.length <= 1"
                @click="removeNode(index)"
              >
                <Trash2 :size="17" />
              </button>
              <div class="timeline-caption">{{ formatDateTime(node.at) }}</div>
            </article>
          </div>
        </div>

        <footer class="modal-actions">
          <button type="button" class="button" @click="emit('close')">取消</button>
          <button type="button" class="button primary" @click="submit">保存时间线</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
