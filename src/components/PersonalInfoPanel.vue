<script setup>
import { computed, reactive, ref } from 'vue';
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
let activePointerId = null;

const totalItems = computed(() => props.groups
  .reduce((total, group) => total + group.items.length, 0));

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
  const values = String(drafts[group.key] || '')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.length) return;

  updateGroupItems(group.key, [
    ...group.items,
    ...values.map((text) => ({ id: uid(), text })),
  ]);
  drafts[group.key] = '';
  emit('toast', `已向${group.title}添加 ${values.length} 条信息`);
}

async function copyItem(item) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(item.text);
    } else {
      const input = document.createElement('textarea');
      input.value = item.text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    emit('toast', '已复制到剪贴板');
  } catch (error) {
    console.warn('无法复制个人信息', error);
    emit('toast', '复制失败');
  }
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
  if (editingId.value === item.id) cancelEdit();
  emit('toast', '信息已删除');
}
</script>

<template>
  <section class="personal-info-panel">
    <div class="personal-info-overview">
      <div class="personal-info-overview-counts">
        <span>{{ groups.length }} 个分组</span>
        <span>{{ totalItems }} 条信息</span>
      </div>
      <form class="personal-info-group-add" @submit.prevent="addGroup">
        <input v-model="groupNameDraft" aria-label="新分组名称" placeholder="新分组名称" />
        <button type="submit" class="button compact" :disabled="!groupNameDraft.trim()">
          <FolderPlus :size="17" />新增分组
        </button>
      </form>
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
            rows="2"
            :aria-label="`新增${group.title}`"
            :placeholder="`输入${group.title}，每行一条`"
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
  </section>
</template>
