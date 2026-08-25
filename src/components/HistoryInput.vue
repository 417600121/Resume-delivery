<script setup>
import { computed, nextTick, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const open = ref(false);
const displayMode = ref('filtered');
const input = ref(null);

const matches = computed(() => {
  if (displayMode.value === 'all') return props.suggestions;
  const query = props.modelValue.trim().toLowerCase();
  return props.suggestions
    .filter((item) => !query || item.toLowerCase().startsWith(query))
    .slice(0, 8);
});

function handleInput(event) {
  emit('update:modelValue', event.target.value);
  displayMode.value = 'filtered';
  open.value = true;
}

function toggleAllOptions() {
  if (open.value && displayMode.value === 'all') {
    open.value = false;
    return;
  }
  displayMode.value = 'all';
  open.value = true;
}

function select(value) {
  emit('update:modelValue', value);
  open.value = false;
  nextTick(() => input.value?.focus());
}

function closeLater() {
  window.setTimeout(() => { open.value = false; }, 100);
}
</script>

<template>
  <div class="history-input">
    <input
      ref="input"
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      autocomplete="off"
      @input="handleInput"
      @blur="closeLater"
      @keydown.esc="open = false"
    />
    <button
      type="button"
      class="field-chevron"
      title="显示全部选项"
      aria-label="显示全部选项"
      :aria-expanded="open"
      @mousedown.prevent="toggleAllOptions"
    >
      <ChevronDown :size="16" />
    </button>
    <div v-if="open && matches.length" class="suggestion-menu">
      <button
        v-for="item in matches"
        :key="item"
        type="button"
        class="suggestion-item"
        @mousedown.prevent="select(item)"
      >
        {{ item }}
      </button>
    </div>
  </div>
</template>
