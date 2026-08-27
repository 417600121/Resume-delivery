<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  watch,
} from 'vue';
import { Check, ChevronDown } from 'lucide-vue-next';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);
const attrs = useAttrs();
const root = ref(null);
const trigger = ref(null);
const menu = ref(null);
const open = ref(false);
const highlightedIndex = ref(-1);
const popoverStyle = ref({});

const triggerAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});

const normalizedOptions = computed(() => props.options.map((option) => {
  if (option && typeof option === 'object') {
    return {
      value: option.value ?? option.label ?? '',
      label: String(option.label ?? option.value ?? ''),
    };
  }
  return { value: option, label: String(option ?? '') };
}));

const selectedIndex = computed(() => normalizedOptions.value.findIndex(
  (option) => String(option.value) === String(props.modelValue),
));

const selectedOption = computed(() => normalizedOptions.value[selectedIndex.value] || null);

function close() {
  open.value = false;
  highlightedIndex.value = -1;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updatePopoverPosition() {
  const triggerRect = trigger.value?.getBoundingClientRect();
  if (!triggerRect) return;

  const viewportPadding = 12;
  const menuWidth = Math.min(
    Math.max(triggerRect.width, 176),
    Math.max(120, window.innerWidth - viewportPadding * 2),
  );
  const left = clamp(
    triggerRect.right - menuWidth,
    viewportPadding,
    Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
  );
  const spaceBelow = Math.max(40, window.innerHeight - triggerRect.bottom - viewportPadding);
  const spaceAbove = Math.max(40, triggerRect.top - viewportPadding);
  const estimatedHeight = Math.min(280, normalizedOptions.value.length * 38 + 10);
  const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
  const availableHeight = openAbove ? spaceAbove : spaceBelow;

  popoverStyle.value = {
    width: `${menuWidth}px`,
    maxHeight: `${Math.min(280, availableHeight)}px`,
    left: `${left}px`,
    top: openAbove ? 'auto' : `${triggerRect.bottom + 7}px`,
    bottom: openAbove ? `${window.innerHeight - triggerRect.top + 7}px` : 'auto',
  };
}

function openMenu() {
  if (props.disabled || !normalizedOptions.value.length) return;
  open.value = true;
  highlightedIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0;
}

function toggle() {
  if (open.value) close();
  else openMenu();
}

function choose(option) {
  emit('update:modelValue', option.value);
  emit('change', option.value);
  close();
  nextTick(() => trigger.value?.focus());
}

function moveHighlight(step) {
  const count = normalizedOptions.value.length;
  if (!count) return;
  const current = highlightedIndex.value >= 0 ? highlightedIndex.value : selectedIndex.value;
  const next = current < 0
    ? (step > 0 ? 0 : count - 1)
    : (current + step + count) % count;
  highlightedIndex.value = next;
}

function handleKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!open.value) openMenu();
    else moveHighlight(1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (!open.value) openMenu();
    else moveHighlight(-1);
    return;
  }
  if (event.key === 'Home' && open.value) {
    event.preventDefault();
    highlightedIndex.value = 0;
    return;
  }
  if (event.key === 'End' && open.value) {
    event.preventDefault();
    highlightedIndex.value = normalizedOptions.value.length - 1;
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && !open.value) {
    event.preventDefault();
    openMenu();
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && open.value) {
    event.preventDefault();
    const option = normalizedOptions.value[highlightedIndex.value];
    if (option) choose(option);
    return;
  }
  if (event.key === 'Escape') {
    if (!open.value) return;
    event.preventDefault();
    close();
    return;
  }
  if (event.key === 'Tab') close();
}

function handleOutsidePointerDown(event) {
  if (!root.value?.contains(event.target) && !menu.value?.contains(event.target)) close();
}

function handleViewportChange() {
  if (open.value) updatePopoverPosition();
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    nextTick(updatePopoverPosition);
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
  <div ref="root" class="select-menu" :class="[attrs.class, { open, disabled }]">
    <button
      ref="trigger"
      v-bind="triggerAttrs"
      type="button"
      class="select-menu-trigger"
      :disabled="disabled"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <span class="select-menu-value" :class="{ placeholder: !selectedOption }">
        {{ selectedOption?.label || placeholder }}
      </span>
      <ChevronDown class="select-menu-chevron" :size="17" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div v-if="open" ref="menu" class="select-menu-popover" :style="popoverStyle" role="listbox">
        <button
          v-for="(option, index) in normalizedOptions"
          :key="`${option.value}-${index}`"
          type="button"
          class="select-menu-option"
          :class="{ selected: selectedIndex === index, highlighted: highlightedIndex === index }"
          role="option"
          :aria-selected="selectedIndex === index"
          @mouseenter="highlightedIndex = index"
          @click="choose(option)"
        >
          <span>{{ option.label }}</span>
          <Check v-if="selectedIndex === index" :size="15" aria-hidden="true" />
        </button>
      </div>
    </Teleport>
  </div>
</template>
