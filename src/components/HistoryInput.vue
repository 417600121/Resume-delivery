<script setup>
import { computed, nextTick, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

const props = defineProps({
  modelValue: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const open = ref(false);
const input = ref(null);

const matches = computed(() => {
  const query = props.modelValue.trim().toLowerCase();
  return props.suggestions
    .filter((item) => !query || item.toLowerCase().includes(query))
    .slice(0, 8);
});

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
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      autocomplete="off"
      @input="emit('update:modelValue', $event.target.value)"
      @focus="open = true"
      @blur="closeLater"
      @keydown.esc="open = false"
    />
    <button type="button" class="field-chevron" title="显示历史选项" @mousedown.prevent="open = !open">
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
