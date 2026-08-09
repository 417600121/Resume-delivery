<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FolderPlus,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-vue-next';
import { uid } from '../lib/data.js';

const props = defineProps({
  groups: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:groups', 'toast']);
const panelElement = ref(null);
const drafts = reactive({});
const groupNameDraft = ref('');
const expandedKeys = ref(new Set([props.groups[0]?.key || 'personal']));
const editingGroupKey = ref('');
const editingGroupTitle = ref('');
const editingId = ref('');
const editingText = ref('');
const draggingId = ref('');
const draggingGroupKey = ref('');
const dropTargetGroupKey = ref('');
const dropTargetId = ref('');
const dropPosition = ref('before');
const selectedIds = ref(new Set());
const selectionBox = ref(null);
let activePointerId = null;
let selectionPointerId = null;
let selectionStart = null;
let selectionStartItemId = '';
let selectionBaseIds = new Set();
let selectionMoved = false;

const totalItems = computed(() => props.groups
  .reduce((total, group) => total + group.items.length, 0));
const selectedItems = computed(() => props.groups
  .flatMap((group) => group.items)
  .filter((item) => selectedIds.value.has(item.id)));
const selectedCount = computed(() => selectedItems.value.length);

onUnmounted(() => {
  document.body.classList.remove('personal-info-dragging', 'personal-info-selecting');
});

function isExpanded(key) {
  return expandedKeys.value.has(key);
}

function toggleGroup(key) {
  const next = new Set(expandedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKeys.value = next;
}

function expandGroup(key) {
  if (expandedKeys.value.has(key)) return;
  expandedKeys.value = new Set([...expandedKeys.value, key]);
}

function updateGroups(groups) {
  emit('update:groups', groups);
}

function addGroup() {
  const title = groupNameDraft.value.trim();
  if (!title) return;
  const group = { key: uid(), title, items: [] };
  updateGroups([...props.groups, group]);
  groupNameDraft.value = '';
  expandGroup(group.key);
  emit('toast', `已新增分组“${title}”`);
}

function startGroupEdit(group) {
  editingGroupKey.value = group.key;
  editingGroupTitle.value = group.title;
}

function cancelGroupEdit() {
  editingGroupKey.value = '';
  editingGroupTitle.value = '';
}

function saveGroupTitle(group) {
  const title = editingGroupTitle.value.trim();
  if (!title) return;
  updateGroups(props.groups.map((current) => (
    current.key === group.key ? { ...current, title } : current
  )));
  cancelGroupEdit();
  emit('toast', '分组名称已更新');
}

function moveGroup(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= props.groups.length) return;
  const next = [...props.groups];
  [next[index], next[target]] = [next[target], next[index]];
  updateGroups(next);
}

function updateGroupItems(groupKey, items) {
  updateGroups(props.groups.map((group) => (
    group.key === groupKey ? { ...group, items } : group
  )));
}

function addItems(group) {
  const text = String(drafts[group.key] || '').trim();
  if (!text) return;

  updateGroupItems(group.key, [
    ...group.items,
    { id: uid(), text },
  ]);
  drafts[group.key] = '';
  emit('toast', `已向${group.title}添加 1 条信息`);
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

async function copyItem(item) {
  try {
    await writeToClipboard(item.text);
    emit('toast', '已复制到剪贴板');
  } catch (error) {
    console.warn('无法复制个人信息', error);
    emit('toast', '复制失败');
  }
}

async function copySelected() {
  if (!selectedItems.value.length) return;
  try {
    await writeToClipboard(selectedItems.value.map((item) => item.text).join('\n\n'));
    emit('toast', `已复制 ${selectedItems.value.length} 条信息`);
  } catch (error) {
    console.warn('无法复制所选个人信息', error);
    emit('toast', '复制失败');
  }
}

function startBoxSelection(event) {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  if (event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('button, input, textarea, select, a')) return;

  selectionPointerId = event.pointerId;
  selectionStart = { x: event.clientX, y: event.clientY };
  selectionStartItemId = target.closest('.personal-info-row')?.dataset.itemId || '';
  selectionBaseIds = event.ctrlKey || event.metaKey
    ? new Set(selectedIds.value)
    : new Set();
  selectionMoved = false;
  selectionBox.value = {
    left: event.clientX,
    top: event.clientY,
    width: 0,
    height: 0,
  };
  panelElement.value?.setPointerCapture?.(event.pointerId);
  document.body.classList.add('personal-info-selecting');
  event.preventDefault();
}

function updateBoxSelection(event) {
  if (selectionPointerId === null || event.pointerId !== selectionPointerId || !selectionStart) return;
  const deltaX = event.clientX - selectionStart.x;
  const deltaY = event.clientY - selectionStart.y;
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) selectionMoved = true;

  const bounds = {
    left: Math.min(selectionStart.x, event.clientX),
    top: Math.min(selectionStart.y, event.clientY),
    right: Math.max(selectionStart.x, event.clientX),
    bottom: Math.max(selectionStart.y, event.clientY),
  };
  selectionBox.value = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
  };

  if (!selectionMoved) return;
  const next = new Set(selectionBaseIds);
  panelElement.value?.querySelectorAll('.personal-info-row').forEach((row) => {
    const rowBounds = row.getBoundingClientRect();
    const intersects = rowBounds.width > 0
      && rowBounds.height > 0
      && rowBounds.right >= bounds.left
      && rowBounds.left <= bounds.right
      && rowBounds.bottom >= bounds.top
      && rowBounds.top <= bounds.bottom;
    if (intersects) next.add(row.dataset.itemId);
  });
  selectedIds.value = next;
}

function resetBoxSelection(event) {
  if (panelElement.value?.hasPointerCapture?.(event.pointerId)) {
    panelElement.value.releasePointerCapture(event.pointerId);
  }
  selectionPointerId = null;
  selectionStart = null;
  selectionStartItemId = '';
  selectionBaseIds = new Set();
  selectionMoved = false;
  selectionBox.value = null;
  document.body.classList.remove('personal-info-selecting');
}

function finishBoxSelection(event) {
  if (selectionPointerId === null || event.pointerId !== selectionPointerId) return;
  if (!selectionMoved) {
    if (selectionStartItemId) {
      const next = new Set(selectionBaseIds);
      if ((event.ctrlKey || event.metaKey) && next.has(selectionStartItemId)) {
        next.delete(selectionStartItemId);
      } else {
        next.add(selectionStartItemId);
      }
      selectedIds.value = next;
    } else if (!(event.ctrlKey || event.metaKey)) {
      selectedIds.value = new Set();
    }
  }
  resetBoxSelection(event);
}

function cancelBoxSelection(event) {
  if (selectionPointerId === null || event.pointerId !== selectionPointerId) return;
  selectedIds.value = new Set(selectionBaseIds);
  resetBoxSelection(event);
}

function startEdit(item) {
  editingId.value = item.id;
  editingText.value = item.text;
}

function cancelEdit() {
  editingId.value = '';
  editingText.value = '';
}

function saveEdit(group, item) {
  const text = editingText.value.trim();
  if (!text) return;
  updateGroupItems(group.key, group.items.map((current) => (
    current.id === item.id ? { ...current, text } : current
  )));
  cancelEdit();
  emit('toast', '信息已更新');
}

function moveItem(group, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= group.items.length) return;
  const next = [...group.items];
  [next[index], next[target]] = [next[target], next[index]];
  updateGroupItems(group.key, next);
}

function startDrag(group, item, event) {
  if (event.button !== undefined && event.button !== 0) return;
  draggingId.value = item.id;
  draggingGroupKey.value = group.key;
  dropTargetGroupKey.value = '';
  dropTargetId.value = '';
  activePointerId = event.pointerId;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  document.body.classList.add('personal-info-dragging');
}

function updateDropTarget(event) {
  if (!draggingId.value || event.pointerId !== activePointerId) return;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const row = element?.closest('.personal-info-row');
  const targetId = row?.dataset.itemId || '';
  const targetGroupKey = row?.dataset.groupKey
    || element?.closest('[data-drop-group]')?.dataset.dropGroup
    || '';
  if (!targetGroupKey || targetId === draggingId.value) {
    dropTargetGroupKey.value = '';
    dropTargetId.value = '';
    return;
  }

  dropTargetGroupKey.value = targetGroupKey;
  dropTargetId.value = targetId;
  if (row) {
    const bounds = row.getBoundingClientRect();
    dropPosition.value = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  } else {
    dropPosition.value = 'after';
  }
}

function resetDrag(event) {
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  draggingId.value = '';
  draggingGroupKey.value = '';
  dropTargetGroupKey.value = '';
  dropTargetId.value = '';
  activePointerId = null;
  document.body.classList.remove('personal-info-dragging');
}

function finishDrag(event) {
  if (!draggingId.value || event.pointerId !== activePointerId) return;

  const nextGroups = props.groups.map((group) => ({ ...group, items: [...group.items] }));
  const sourceGroup = nextGroups.find((group) => group.key === draggingGroupKey.value);
  const targetGroup = nextGroups.find((group) => group.key === dropTargetGroupKey.value);
  const sourceIndex = sourceGroup?.items.findIndex((item) => item.id === draggingId.value) ?? -1;
  const targetIndex = targetGroup?.items.findIndex((item) => item.id === dropTargetId.value) ?? -1;
  if (sourceGroup && targetGroup && sourceIndex >= 0) {
    const [moved] = sourceGroup.items.splice(sourceIndex, 1);
    let insertIndex = targetIndex >= 0
      ? targetIndex + (dropPosition.value === 'after' ? 1 : 0)
      : targetGroup.items.length;
    if (targetIndex >= 0 && sourceGroup.key === targetGroup.key && sourceIndex < insertIndex) {
      insertIndex -= 1;
    }
    targetGroup.items.splice(insertIndex, 0, moved);
    if (sourceGroup.key !== targetGroup.key || insertIndex !== sourceIndex) {
      updateGroups(nextGroups);
      expandGroup(targetGroup.key);
    }
  }

  resetDrag(event);
}

function cancelDrag(event) {
  if (!draggingId.value || event.pointerId !== activePointerId) return;
  resetDrag(event);
}

function deleteItem(group, item) {
  const preview = item.text.length > 24 ? `${item.text.slice(0, 24)}...` : item.text;
  if (!window.confirm(`确定删除“${preview}”吗？`)) return;
  updateGroupItems(group.key, group.items.filter((current) => current.id !== item.id));
  if (selectedIds.value.has(item.id)) {
    const nextSelected = new Set(selectedIds.value);
    nextSelected.delete(item.id);
    selectedIds.value = nextSelected;
  }
  if (editingId.value === item.id) cancelEdit();
  emit('toast', '信息已删除');
}
</script>

<template>
  <section
    ref="panelElement"
    class="personal-info-panel"
    :class="{ 'is-box-selecting': selectionBox }"
    @pointerdown="startBoxSelection"
    @pointermove="updateBoxSelection"
    @pointerup="finishBoxSelection"
    @pointercancel="cancelBoxSelection"
  >
    <div class="personal-info-overview">
      <div class="personal-info-overview-counts">
        <span>{{ groups.length }} 个分组</span>
        <span>{{ totalItems }} 条信息</span>
        <span v-if="selectedCount" class="personal-info-selected-count">已选择 {{ selectedCount }} 条</span>
      </div>
      <div class="personal-info-overview-actions">
        <form class="personal-info-group-add" @submit.prevent="addGroup">
          <input v-model="groupNameDraft" aria-label="新分组名称" placeholder="新分组名称" />
          <button type="submit" class="button compact" :disabled="!groupNameDraft.trim()">
            <FolderPlus :size="17" />新增分组
          </button>
        </form>
        <button type="button" class="button compact personal-info-selection-copy" :disabled="!selectedCount" @click="copySelected">
          <Copy :size="17" />{{ selectedCount ? `复制已选 ${selectedCount}` : '复制已选' }}
        </button>
      </div>
    </div>

    <section
      v-for="(group, groupIndex) in groups"
      :key="group.key"
      class="personal-info-group"
      :class="{
        'drop-group-target': draggingId && dropTargetGroupKey === group.key && !dropTargetId,
      }"
    >
      <div
        class="personal-info-group-header"
        :data-drop-group="group.key"
      >
        <div v-if="editingGroupKey === group.key" class="personal-info-group-name-editor">
          <input
            v-model="editingGroupTitle"
            aria-label="修改分组名称"
            @keydown.enter.prevent="saveGroupTitle(group)"
            @keydown.esc.prevent="cancelGroupEdit"
          />
          <button type="button" class="icon-button confirm" title="保存分组名称" :disabled="!editingGroupTitle.trim()" @click="saveGroupTitle(group)">
            <Check :size="17" />
          </button>
          <button type="button" class="icon-button" title="取消修改" @click="cancelGroupEdit">
            <X :size="17" />
          </button>
        </div>

        <template v-else>
          <button
            type="button"
            class="personal-info-group-toggle"
            :aria-expanded="isExpanded(group.key)"
            :aria-controls="`personal-info-group-${group.key}`"
            @click="toggleGroup(group.key)"
          >
            <ChevronDown
              :size="19"
              class="personal-info-group-chevron"
              :class="{ expanded: isExpanded(group.key) }"
            />
            <span class="personal-info-group-title">{{ group.title }}</span>
            <span class="personal-info-group-count">{{ group.items.length }} 条</span>
          </button>
          <div class="personal-info-group-actions">
            <button
              type="button"
              class="icon-button"
              title="分组上移"
              :disabled="groupIndex === 0"
              @click="moveGroup(groupIndex, -1)"
            >
              <ArrowUp :size="17" />
            </button>
            <button
              type="button"
              class="icon-button"
              title="分组下移"
              :disabled="groupIndex === groups.length - 1"
              @click="moveGroup(groupIndex, 1)"
            >
              <ArrowDown :size="17" />
            </button>
            <button type="button" class="icon-button" title="修改分组名称" @click="startGroupEdit(group)">
              <Pencil :size="16" />
            </button>
          </div>
        </template>
      </div>

      <div
        v-show="isExpanded(group.key)"
        :id="`personal-info-group-${group.key}`"
        class="personal-info-group-body"
        :data-drop-group="group.key"
      >
        <form class="personal-info-add" @submit.prevent="addItems(group)">
          <textarea
            v-model="drafts[group.key]"
            rows="4"
            :aria-label="`新增${group.title}`"
            :placeholder="`输入${group.title}，支持多行文本`"
            @keydown.ctrl.enter.prevent="addItems(group)"
          ></textarea>
          <button type="submit" class="button primary" :disabled="!String(drafts[group.key] || '').trim()">
            <Plus :size="18" />添加
          </button>
        </form>

        <ol v-if="group.items.length" class="personal-info-list">
          <li
            v-for="(item, index) in group.items"
            :key="item.id"
            class="personal-info-row"
            :class="{
              'is-dragging': draggingId === item.id,
              'is-selected': selectedIds.has(item.id),
              'drop-before': dropTargetGroupKey === group.key && dropTargetId === item.id && dropPosition === 'before',
              'drop-after': dropTargetGroupKey === group.key && dropTargetId === item.id && dropPosition === 'after',
            }"
            :data-item-id="item.id"
            :data-group-key="group.key"
          >
            <span class="personal-info-index">{{ index + 1 }}</span>

            <template v-if="editingId === item.id">
              <textarea
                v-model="editingText"
                class="personal-info-edit-input"
                :aria-label="`编辑${group.title}`"
                @keydown.ctrl.enter.prevent="saveEdit(group, item)"
              ></textarea>
              <div class="personal-info-actions">
                <button type="button" class="icon-button confirm" title="保存" :disabled="!editingText.trim()" @click="saveEdit(group, item)">
                  <Check :size="17" />
                </button>
                <button type="button" class="icon-button" title="取消" @click="cancelEdit">
                  <X :size="17" />
                </button>
              </div>
            </template>

            <template v-else>
              <button type="button" class="personal-info-copy-target" title="点击复制" @click="copyItem(item)">
                <span>{{ item.text }}</span>
                <Copy :size="16" />
              </button>
              <div class="personal-info-actions">
                <button type="button" class="icon-button" title="编辑" @click="startEdit(item)">
                  <Pencil :size="16" />
                </button>
                <button
                  type="button"
                  class="icon-button personal-info-drag-handle"
                  :aria-label="`拖拽调整${group.title}第 ${index + 1} 条信息顺序`"
                  title="拖拽调整顺序"
                  @pointerdown.prevent="startDrag(group, item, $event)"
                  @pointermove.prevent="updateDropTarget"
                  @pointerup.prevent="finishDrag"
                  @pointercancel.prevent="cancelDrag"
                  @keydown.up.prevent="moveItem(group, index, -1)"
                  @keydown.down.prevent="moveItem(group, index, 1)"
                >
                  <GripVertical :size="18" />
                </button>
                <button type="button" class="icon-button danger" title="删除" @click="deleteItem(group, item)">
                  <Trash2 :size="16" />
                </button>
              </div>
            </template>
          </li>
        </ol>

        <div v-else class="personal-info-empty">暂无{{ group.title }}</div>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="selectionBox"
        class="personal-info-selection-box"
        :style="{
          left: `${selectionBox.left}px`,
          top: `${selectionBox.top}px`,
          width: `${selectionBox.width}px`,
          height: `${selectionBox.height}px`,
        }"
      ></div>
    </Teleport>
  </section>
</template>
