<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { ExternalLink, Plus, Trash2, X } from 'lucide-vue-next';
import {
  INTERVIEW_ROUNDS,
  clone,
  formatDateTime,
  isWebLink,
  nowLocal,
  sortStatusHistory,
  statusClass,
  uid,
} from '../lib/data.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
  options: { type: Object, required: true },
});

const emit = defineEmits(['close', 'save']);
const draft = reactive({ nodes: [] });
const selectedNodeId = ref('');

const summary = computed(() => {
  if (!props.record) return '';
  return [props.record.company, props.record.position].filter(Boolean).join(' · ');
});
const selectedNode = computed(() => (
  draft.nodes.find((node) => node.id === selectedNodeId.value) || draft.nodes.at(-1) || null
));
const sortedNodes = computed(() => sortStatusHistory(draft.nodes));
const selectedNodeIndex = computed(() => (
  selectedNode.value ? sortedNodes.value.findIndex((node) => node.id === selectedNode.value.id) : -1
));

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    draft.nodes = clone(props.record?.statusHistory || [])
      .map((node) => ({ ...node, id: node.id || uid() }));
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
    selectedNodeId.value = sortedNodes.value.at(-1)?.id || '';
  },
  { immediate: true },
);

function addNode() {
  const node = {
    id: uid(),
    status: sortedNodes.value.at(-1)?.status || props.options.status[0] || '已投递',
    at: nowLocal(),
    note: '',
    round: '',
    link: '',
  };
  draft.nodes.push(node);
  selectedNodeId.value = node.id;
  nextTick(() => {
    document.querySelector(`[data-history-node-id="${node.id}"]`)?.scrollIntoView({ block: 'nearest' });
  });
}

function removeNode() {
  if (draft.nodes.length <= 1) return;
  const selectedIndex = selectedNodeIndex.value;
  const selectedId = selectedNodeId.value;
  draft.nodes = draft.nodes.filter((node) => node.id !== selectedId);
  selectedNodeId.value = sortStatusHistory(draft.nodes)[Math.min(selectedIndex, draft.nodes.length - 1)]?.id || '';
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
  const nodes = sortStatusHistory(draft.nodes)
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
      <section class="modal modal-wide modal-history" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
        <header class="modal-head">
          <div>
            <h3 id="history-modal-title">修改投递状态</h3>
            <p class="modal-subtitle">{{ summary }}</p>
          </div>
          <button type="button" class="modal-close" title="关闭" @click="emit('close')"><X :size="20" /></button>
        </header>

        <div class="history-workspace">
          <aside class="history-node-sidebar">
            <div class="history-node-sidebar-head">
              <strong>状态节点</strong>
              <span>{{ draft.nodes.length }} 个</span>
            </div>
            <div class="history-node-list" role="list">
              <button
                v-for="(node, index) in sortedNodes"
                :key="node.id"
                type="button"
                class="history-node-item"
                :class="{ active: selectedNodeId === node.id }"
                :data-history-node-id="node.id"
                :aria-current="selectedNodeId === node.id ? 'true' : undefined"
                @click="selectedNodeId = node.id"
              >
                <span class="history-node-index">{{ index + 1 }}</span>
                <span class="history-node-item-content">
                  <span class="history-node-item-status">
                    <span class="tag" :class="statusClass(node.status)">{{ node.status || '未设置状态' }}</span>
                    <span v-if="node.status === '面试中' && node.round" class="history-node-round">{{ node.round }}</span>
                  </span>
                  <span class="history-node-time">{{ formatDateTime(node.at) }}</span>
                  <span v-if="node.note" class="history-node-note-preview">{{ node.note }}</span>
                </span>
              </button>
            </div>
            <button type="button" class="button history-add-node" @click="addNode">
              <Plus :size="16" />添加节点
            </button>
          </aside>

          <section v-if="selectedNode" class="history-node-detail">
            <header class="history-node-detail-head">
              <div>
                <span>节点 {{ selectedNodeIndex + 1 }}</span>
                <h4>{{ selectedNode.status || '未设置状态' }}<template v-if="selectedNode.status === '面试中' && selectedNode.round"> · {{ selectedNode.round }}</template></h4>
              </div>
              <button
                type="button"
                class="button history-delete-node"
                title="删除当前状态节点"
                :disabled="draft.nodes.length <= 1"
                @click="removeNode"
              >
                <Trash2 :size="16" />删除节点
              </button>
            </header>

            <div class="history-detail-form">
              <div class="field">
                <label>状态</label>
                <select v-model="selectedNode.status" @change="changeStatus(selectedNode)">
                  <option v-for="item in statusOptions(selectedNode)" :key="item" :value="item">{{ item }}</option>
                </select>
              </div>
              <div class="field">
                <label>发生时间</label>
                <input v-model="selectedNode.at" type="datetime-local" step="60" />
              </div>
              <div v-if="selectedNode.status === '面试中'" class="field">
                <label>面试轮次</label>
                <select v-model="selectedNode.round">
                  <option value="">选择轮次</option>
                  <option v-for="round in INTERVIEW_ROUNDS" :key="round" :value="round">{{ round }}</option>
                </select>
              </div>
              <div class="field history-detail-note">
                <label>节点备注</label>
                <textarea
                  v-model.trim="selectedNode.note"
                  rows="7"
                  placeholder="可填写账号、密码、联系人、注意事项等文本"
                ></textarea>
              </div>
              <div class="field history-detail-link">
                <label>{{ linkFieldLabel(selectedNode.status) }}</label>
                <div class="link-field">
                  <input v-model.trim="selectedNode.link" :placeholder="linkFieldPlaceholder(selectedNode.status)" />
                  <a
                    v-if="isWebLink(selectedNode.link)"
                    class="button interview-open-button"
                    :href="selectedNode.link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink :size="17" />{{ linkButtonLabel(selectedNode.status) }}
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer class="modal-actions history-modal-actions">
          <span>当前编辑节点 {{ selectedNodeIndex + 1 }} / {{ draft.nodes.length }}</span>
          <div class="modal-actions-group">
            <button type="button" class="button" @click="emit('close')">取消</button>
            <button type="button" class="button primary" @click="submit">保存时间线</button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
