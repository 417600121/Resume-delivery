<script setup>
import { reactive, watch } from 'vue';
import { X } from 'lucide-vue-next';
import HistoryInput from './HistoryInput.vue';
import { clone } from '../lib/data.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
  options: { type: Object, required: true },
  positionSuggestions: { type: Array, default: () => [] },
  locationSuggestions: { type: Array, default: () => [] },
  sourceSuggestions: { type: Array, default: () => [] },
  prioritySuggestions: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'save']);

const draft = reactive({});

function resetDraft() {
  Object.keys(draft).forEach((key) => delete draft[key]);
  Object.assign(draft, clone(props.record || {
    company: '',
    position: '',
    source: props.options.source[0] || '',
    sourceDetail: '',
    link: '',
    date: '',
    status: '待投递',
    location: '',
    nextStep: '',
    priority: props.options.priority.includes('中') ? '中' : props.options.priority[0] || '',
    notes: '',
  }));
}

watch(() => props.open, (value) => { if (value) resetDraft(); }, { immediate: true });

function submit() {
  const value = clone(draft);
  value.source = String(value.source || '').trim();
  value.priority = String(value.priority || '').trim();
  if (!props.record) {
    value.status = '待投递';
    value.date = '';
  }
  emit('save', value);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
        <header class="modal-head">
          <h3 id="record-modal-title">{{ record ? '编辑投递' : '新增投递' }}</h3>
          <button type="button" class="modal-close" title="关闭" @click="emit('close')"><X :size="20" /></button>
        </header>
        <form class="form" @submit.prevent="submit">
          <div class="field">
            <label>公司名称 *</label>
            <input v-model.trim="draft.company" required placeholder="例如：字节跳动" />
          </div>
          <div class="field">
            <label>职位名称 *</label>
            <HistoryInput v-model="draft.position" :suggestions="positionSuggestions" required placeholder="输入或选择历史职位" />
          </div>
          <div class="field">
            <label>消息来源</label>
            <HistoryInput v-model="draft.source" :suggestions="sourceSuggestions" placeholder="输入或选择消息来源" />
          </div>
          <div v-if="draft.source === '其他'" class="field">
            <label>其他来源说明</label>
            <input v-model.trim="draft.sourceDetail" placeholder="例如：同学转发 / 行业交流群" />
          </div>
          <div class="field full">
            <label>招聘信息 / 备注（支持 Markdown）</label>
            <textarea v-model="draft.link" class="record-markdown-input" placeholder="可填写链接、岗位说明、内推信息或 Markdown 内容"></textarea>
          </div>
          <div class="field">
            <label>当前投递状态</label>
            <input :value="draft.status || '待投递'" disabled />
          </div>
          <div class="field">
            <label>下一步计划</label>
            <input v-model.trim="draft.nextStep" placeholder="例如：周五前跟进 HR" />
          </div>
          <div class="field">
            <label>工作地点</label>
            <HistoryInput v-model="draft.location" :suggestions="locationSuggestions" placeholder="输入或选择历史地点" />
          </div>
          <div class="field">
            <label>优先级</label>
            <HistoryInput v-model="draft.priority" :suggestions="prioritySuggestions" placeholder="输入或选择优先级" />
          </div>
          <div class="field full">
            <label>备注</label>
            <textarea v-model.trim="draft.notes" placeholder="记录岗位亮点、联系人、薪资范围或面试反馈"></textarea>
          </div>
          <footer class="form-actions">
            <button type="button" class="button" @click="emit('close')">取消</button>
            <button type="submit" class="button primary">保存记录</button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
