<script setup>
import { reactive, watch } from 'vue';
import { Plus, Trash2, X } from 'lucide-vue-next';
import { clone } from '../lib/data.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  options: { type: Object, required: true },
});

const emit = defineEmits(['close', 'save']);
const draft = reactive({ status: [], source: [], priority: [] });
const newValues = reactive({ status: '', source: '', priority: '' });

const groups = [
  { key: 'status', label: '投递状态', placeholder: '例如：等待反馈' },
  { key: 'source', label: '消息来源', placeholder: '例如：校招群' },
  { key: 'priority', label: '优先级', placeholder: '例如：重点' },
];

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.assign(draft, clone(props.options));
    Object.keys(newValues).forEach((key) => { newValues[key] = ''; });
  },
  { immediate: true },
);

function addOption(key) {
  const value = newValues[key].trim();
  if (!value) return;
  if (!draft[key].includes(value)) draft[key].push(value);
  newValues[key] = '';
}

function removeOption(key, index) {
  if (draft[key].length <= 1) return;
  draft[key].splice(index, 1);
}

function submit() {
  emit('save', clone(draft));
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
      <section class="modal modal-options" role="dialog" aria-modal="true" aria-labelledby="options-modal-title">
        <header class="modal-head">
          <h3 id="options-modal-title">选项设置</h3>
          <button type="button" class="modal-close" title="关闭" @click="emit('close')"><X :size="20" /></button>
        </header>

        <div class="option-groups">
          <section v-for="group in groups" :key="group.key" class="option-group">
            <h4>{{ group.label }}</h4>
            <form class="option-editor" @submit.prevent="addOption(group.key)">
              <input v-model="newValues[group.key]" :placeholder="group.placeholder" />
              <button type="submit" class="button compact"><Plus :size="16" />添加</button>
            </form>
            <div class="chips">
              <span v-for="(item, index) in draft[group.key]" :key="item" class="chip">
                {{ item }}
                <button
                  type="button"
                  :title="`删除${item}`"
                  :aria-label="`删除${item}`"
                  :disabled="draft[group.key].length <= 1"
                  @click="removeOption(group.key, index)"
                >
                  <Trash2 :size="13" />
                </button>
              </span>
            </div>
          </section>
        </div>

        <footer class="modal-actions">
          <button type="button" class="button" @click="emit('close')">取消</button>
          <button type="button" class="button primary" @click="submit">保存选项</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
