<script setup>
import { computed, ref, watch } from 'vue';
import { Eye, FilePenLine, Save, X } from 'lucide-vue-next';
import { renderMarkdown } from '../lib/markdown.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
});

const emit = defineEmits(['close', 'save']);
const mode = ref('preview');
const draft = ref('');

const renderedMarkdown = computed(() => renderMarkdown(draft.value));
const recordTitle = computed(() => [props.record?.company, props.record?.position].filter(Boolean).join(' · '));

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    draft.value = props.record?.link || '';
    mode.value = draft.value.trim() ? 'preview' : 'edit';
  },
  { immediate: true },
);

function submit() {
  emit('save', draft.value.trim());
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
      <section class="modal modal-markdown" role="dialog" aria-modal="true" aria-labelledby="markdown-modal-title">
        <header class="modal-head">
          <div>
            <h3 id="markdown-modal-title">招聘信息 / 备注</h3>
            <p class="modal-subtitle">{{ recordTitle }}</p>
          </div>
          <button type="button" class="modal-close" title="关闭" @click="emit('close')"><X :size="20" /></button>
        </header>

        <div class="markdown-toolbar">
          <div class="segmented-control" aria-label="Markdown 显示模式">
            <button type="button" :class="{ active: mode === 'preview' }" @click="mode = 'preview'">
              <Eye :size="16" />预览
            </button>
            <button type="button" :class="{ active: mode === 'edit' }" @click="mode = 'edit'">
              <FilePenLine :size="16" />编辑
            </button>
          </div>
        </div>

        <div class="markdown-workspace">
          <div v-if="mode === 'preview'" class="markdown-preview">
            <div v-if="draft.trim()" v-html="renderedMarkdown"></div>
            <div v-else class="markdown-empty">暂无招聘信息或备注</div>
          </div>
          <textarea
            v-else
            v-model="draft"
            class="markdown-editor"
            spellcheck="false"
            placeholder="# 岗位信息&#10;&#10;- 招聘链接：https://example.com&#10;- 薪资范围：&#10;- 岗位要求：&#10;&#10;## 备注"
          ></textarea>
        </div>

        <footer class="modal-actions">
          <button type="button" class="button" @click="emit('close')">取消</button>
          <button type="button" class="button primary" @click="submit"><Save :size="16" />保存文档</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
