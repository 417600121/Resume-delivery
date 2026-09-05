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
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eraser,
} from 'lucide-vue-next';
import { TimePickerPanel } from 'tdesign-vue-next/es/time-picker/index.mjs';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '选择日期和时间' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);
const attrs = useAttrs();
const root = ref(null);
const trigger = ref(null);
const popover = ref(null);
const open = ref(false);
const viewMonth = ref(firstDayOfMonth(new Date()));
const selectedDate = ref(startOfDay(new Date()));
const hour = ref(pad(new Date().getHours()));
const minute = ref(pad(new Date().getMinutes()));
const popoverStyle = ref({});

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const triggerAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});
const displayValue = computed(() => {
  const parsed = parseLocalDateTime(props.modelValue);
  if (!parsed) return '';
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日 ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
});
const monthLabel = computed(() => `${viewMonth.value.getFullYear()} 年 ${viewMonth.value.getMonth() + 1} 月`);
const timePickerValue = computed(() => `${hour.value}:${minute.value}`);
const calendarDays = computed(() => {
  const year = viewMonth.value.getFullYear();
  const month = viewMonth.value.getMonth();
  const firstVisibleDate = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      firstVisibleDate.getFullYear(),
      firstVisibleDate.getMonth(),
      firstVisibleDate.getDate() + index,
    );
    return {
      date,
      key: dateKey(date),
      label: date.getDate(),
      currentMonth: date.getMonth() === month,
      selected: sameDay(date, selectedDate.value),
      today: sameDay(date, new Date()),
    };
  });
});

function pad(value) {
  return String(value).padStart(2, '0');
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a, b) {
  return Boolean(a && b)
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(value || ''));
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText = '00', minuteText = '00'] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const parsedHour = Number(hourText);
  const parsedMinute = Number(minuteText);
  const date = new Date(year, month, day, parsedHour, parsedMinute);
  return date.getFullYear() === year
    && date.getMonth() === month
    && date.getDate() === day
    && date.getHours() === parsedHour
    && date.getMinutes() === parsedMinute
    ? date
    : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resetDraft() {
  const date = parseLocalDateTime(props.modelValue) || new Date();
  selectedDate.value = startOfDay(date);
  viewMonth.value = firstDayOfMonth(date);
  hour.value = pad(date.getHours());
  minute.value = pad(date.getMinutes());
}

function updatePopoverPosition() {
  const triggerRect = trigger.value?.getBoundingClientRect();
  if (!triggerRect) return;

  const viewportPadding = 12;
  const width = Math.min(362, window.innerWidth - viewportPadding * 2);
  const left = clamp(
    triggerRect.left,
    viewportPadding,
    Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
  );
  const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
  const spaceAbove = triggerRect.top - viewportPadding;
  const estimatedHeight = 478;
  const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

  popoverStyle.value = {
    width: `${width}px`,
    maxHeight: `${Math.max(280, openAbove ? spaceAbove : spaceBelow)}px`,
    left: `${left}px`,
    top: openAbove ? 'auto' : `${triggerRect.bottom + 7}px`,
    bottom: openAbove ? `${window.innerHeight - triggerRect.top + 7}px` : 'auto',
  };
}

function openPicker() {
  if (props.disabled) return;
  resetDraft();
  open.value = true;
}

function closePicker(restoreFocus = true) {
  open.value = false;
  if (restoreFocus) nextTick(() => trigger.value?.focus());
}

function togglePicker() {
  if (open.value) closePicker();
  else openPicker();
}

function changeMonth(offset) {
  viewMonth.value = new Date(
    viewMonth.value.getFullYear(),
    viewMonth.value.getMonth() + offset,
    1,
  );
}

function chooseDate(day) {
  selectedDate.value = startOfDay(day.date);
  if (!day.currentMonth) viewMonth.value = firstDayOfMonth(day.date);
}

function chooseToday() {
  const today = new Date();
  selectedDate.value = startOfDay(today);
  viewMonth.value = firstDayOfMonth(today);
}

function chooseNow() {
  const now = new Date();
  selectedDate.value = startOfDay(now);
  viewMonth.value = firstDayOfMonth(now);
  hour.value = pad(now.getHours());
  minute.value = pad(now.getMinutes());
}

function handleTimePickerChange(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return;
  hour.value = match[1];
  minute.value = match[2];
}

function confirm() {
  const value = `${dateKey(selectedDate.value)}T${hour.value}:${minute.value}`;
  emit('update:modelValue', value);
  emit('change', value);
  closePicker();
}

function clear() {
  emit('update:modelValue', '');
  emit('change', '');
  closePicker();
}

function handleOutsidePointerDown(event) {
  if (!root.value?.contains(event.target) && !popover.value?.contains(event.target)) {
    closePicker(false);
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    closePicker();
  }
}

function handleViewportChange() {
  if (open.value) updatePopoverPosition();
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('keydown', handleKeydown);
    nextTick(() => {
      updatePopoverPosition();
    });
  } else {
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('scroll', handleViewportChange, true);
    document.removeEventListener('keydown', handleKeydown);
  }
});

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointerDown));
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown);
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', handleViewportChange, true);
});
</script>

<template>
  <div
    ref="root"
    class="date-time-picker"
    :class="[attrs.class, { open, disabled }]"
    :style="attrs.style"
  >
    <button
      ref="trigger"
      v-bind="triggerAttrs"
      type="button"
      class="date-time-picker-trigger"
      :disabled="disabled"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="togglePicker"
    >
      <CalendarDays :size="17" aria-hidden="true" />
      <span class="date-time-picker-value" :class="{ placeholder: !displayValue }">
        {{ displayValue || placeholder }}
      </span>
      <ChevronDown class="date-time-picker-chevron" :size="17" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <section
        v-if="open"
        ref="popover"
        class="date-time-picker-popover"
        :style="popoverStyle"
        role="dialog"
        aria-label="选择日期和时间"
      >
        <header class="date-time-picker-header">
          <div>
            <strong>{{ monthLabel }}</strong>
            <span>选择发生日期</span>
          </div>
          <div class="date-time-picker-month-actions">
            <button type="button" title="上个月" aria-label="上个月" @click="changeMonth(-1)">
              <ChevronLeft :size="18" />
            </button>
            <button type="button" title="下个月" aria-label="下个月" @click="changeMonth(1)">
              <ChevronRight :size="18" />
            </button>
          </div>
        </header>

        <div class="date-time-picker-weekdays" aria-hidden="true">
          <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
        </div>
        <div class="date-time-picker-calendar" role="grid" :aria-label="monthLabel">
          <button
            v-for="day in calendarDays"
            :key="day.key"
            type="button"
            class="date-time-picker-day"
            role="gridcell"
            :class="{
              outside: !day.currentMonth,
              selected: day.selected,
              today: day.today,
            }"
            :aria-label="`${day.date.getFullYear()}年${day.date.getMonth() + 1}月${day.date.getDate()}日`"
            :aria-selected="day.selected"
            :aria-current="day.today ? 'date' : undefined"
            @click="chooseDate(day)"
          >
            {{ day.label }}
          </button>
        </div>

        <section class="date-time-picker-time" aria-label="选择时间">
          <div class="date-time-picker-time-heading">
            <div class="date-time-picker-time-title">
              <Clock3 :size="16" aria-hidden="true" />
              <span>发生时间</span>
            </div>
            <button type="button" class="date-time-picker-now" @click="chooseNow">现在</button>
          </div>
          <div class="date-time-picker-time-controls">
            <TimePickerPanel
              class="date-time-picker-time-panel"
              :value="timePickerValue"
              format="HH:mm"
              :steps="[1, 1]"
              :is-show-panel="true"
              :is-footer-display="false"
              :on-change="handleTimePickerChange"
            />
          </div>
        </section>

        <footer class="date-time-picker-footer">
          <button type="button" class="date-time-picker-clear" @click="clear">
            <Eraser :size="15" />清除
          </button>
          <div>
            <button type="button" class="button compact" @click="chooseToday">今天</button>
            <button type="button" class="button primary compact" @click="confirm">
              <Check :size="16" />确定
            </button>
          </div>
        </footer>
      </section>
    </Teleport>
  </div>
</template>
