<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { ChevronDown } from 'lucide-vue-next';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const root = ref(null);
const menu = ref(null);
const open = ref(false);
const displayMode = ref('filtered');
const input = ref(null);
const menuStyle = ref({});

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

function updateMenuPosition() {
  const inputRect = root.value?.getBoundingClientRect();
  if (!inputRect) return;

  const viewportPadding = 12;
  const width = Math.min(
    Math.max(inputRect.width, 176),
    Math.max(120, window.innerWidth - viewportPadding * 2),
  );
  const left = Math.min(
    Math.max(viewportPadding, inputRect.left),
    Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
  );
  const spaceBelow = Math.max(40, window.innerHeight - inputRect.bottom - viewportPadding);
  const spaceAbove = Math.max(40, inputRect.top - viewportPadding);
  const estimatedHeight = Math.min(260, matches.value.length * 38 + 10);
  const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
  const availableHeight = openAbove ? spaceAbove : spaceBelow;

  menuStyle.value = {
    width: `${width}px`,
    maxHeight: `${Math.min(260, availableHeight)}px`,
    left: `${left}px`,
    top: openAbove ? 'auto' : `${inputRect.bottom + 7}px`,
    bottom: openAbove ? `${window.innerHeight - inputRect.top + 7}px` : 'auto',
  };
}

function handleViewportChange() {
  if (open.value) updateMenuPosition();
}

function handleOutsidePointerDown(event) {
  if (!root.value?.contains(event.target) && !menu.value?.contains(event.target)) {
    open.value = false;
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    nextTick(updateMenuPosition);
  } else {
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('scroll', handleViewportChange, true);
  }
});

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointerDown));
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown);
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', handleViewportChange, true);
});
</script>

<template>
  <div ref="root" class="history-input">
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
    <Teleport to="body">
      <div v-if="open && matches.length" ref="menu" class="suggestion-menu" :style="menuStyle">
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
    </Teleport>
  </div>
</template>
