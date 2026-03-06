import { ref, computed } from 'vue'

/** Tracks whether the current session is associated with a project file. */
const projectFileHandle = ref<FileSystemFileHandle | null>(null)
const projectFileName = ref<string>('')

export function useProjectStore() {
  const isProjectLoaded = computed(() => !!projectFileHandle.value || !!projectFileName.value)
  const currentProjectName = computed(() => projectFileName.value)

  return { isProjectLoaded, currentProjectName, projectFileHandle, projectFileName }
}

export function setProjectFileHandle(handle: FileSystemFileHandle | null) {
  projectFileHandle.value = handle
  projectFileName.value = handle?.name ?? ''
}

export function setProjectFileName(name: string) {
  projectFileName.value = name
}

export function clearProject() {
  projectFileHandle.value = null
  projectFileName.value = ''
}

export function getProjectFileHandle(): FileSystemFileHandle | null {
  return projectFileHandle.value
}
