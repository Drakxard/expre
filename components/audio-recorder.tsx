"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Trash2, FolderOpen, Video, CheckSquare, HelpCircle, Plus } from "lucide-react"

interface RowItem {
  id: string
  name: string
  checked: boolean
  link?: string
  resources?: {
    videos: ResourceItem[]
    trueFalse: ResourceItem[]
    quizzes: ResourceItem[]
  }
}

interface ResourceItem {
  id: string
  name: string
  link?: string
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export function AudioRecorder({ categoryId = "" }: { categoryId?: string }) {
  const router = useRouter()
  const [rows, setRows] = useState<RowItem[]>([])
  const [hasDirectoryAccess, setHasDirectoryAccess] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window === "undefined") return 1
    const raw = window.localStorage.getItem("audioRecorderZoom")
    const parsed = raw ? Number.parseFloat(raw) : NaN
    if (!Number.isFinite(parsed)) return 1
    return Math.min(2, Math.max(0.6, parsed))
  })
  const inputRefs = useRef<{ [key: string]: HTMLInputElement }>({})
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingFocusRequest = useRef<{ id: string; caretPosition?: number; selectAll?: boolean } | null>(null)
  const [activeResourceModal, setActiveResourceModal] = useState<
    | { rowId: string; type: "videos" | "trueFalse" | "quizzes" }
    | null
  >(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [linkEditor, setLinkEditor] = useState<
    | {
        value: string
        target:
          | { kind: "row"; rowId: string }
          | { kind: "resource"; rowId: string; type: "videos" | "trueFalse" | "quizzes"; resId: string }
      }
    | null
  >(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingResource, setEditingResource] = useState<
    | { rowId: string; type: "videos" | "trueFalse" | "quizzes"; resId: string }
    | null
  >(null)
  const resourceInputRefs = useRef<{ [key: string]: HTMLInputElement }>({})
  const pendingResourceFocus = useRef<{ key: string; selectAll?: boolean } | null>(null)
  const [hoverTrashRowId, setHoverTrashRowId] = useState<string | null>(null)
  const [hoverTrashResource, setHoverTrashResource] = useState<
    | { rowId: string; type: "videos" | "trueFalse" | "quizzes"; resId: string }
    | null
  >(null)
  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [focusedResourceId, setFocusedResourceId] = useState<string | null>(null)

  const rowsKey = categoryId ? `audioRecorderRows::${categoryId}` : "audioRecorderRows"
  const ZOOM_KEY = "audioRecorderZoom"

  const clampZoom = useCallback((value: number) => Math.min(2, Math.max(0.6, value)), [])

  const adjustZoom = useCallback((delta: number) => {
    setZoom((prev) => clampZoom(prev + delta))
  }, [clampZoom])

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_KEY, String(zoom))
    } catch {}
  }, [zoom, ZOOM_KEY])

  const loadRowsFromStorage = useCallback((key: string): RowItem[] => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map((item: any) => {
        const mapResources = (input: any[] | undefined): ResourceItem[] =>
          Array.isArray(input)
            ? input.map((res: any) => ({
                id: String(res?.id ?? ""),
                name: typeof res?.name === "string" ? res.name : "",
                link: typeof res?.link === "string" ? res.link : undefined,
              }))
            : []

        return {
          id: String(item?.id ?? ""),
          name: typeof item?.name === "string" ? item.name : "",
          checked: Boolean(item?.checked),
          link: typeof item?.link === "string" ? item.link : undefined,
          resources: {
            videos: mapResources(item?.resources?.videos),
            trueFalse: mapResources(item?.resources?.trueFalse),
            quizzes: mapResources(item?.resources?.quizzes),
          },
        }
      })
    } catch {
      return []
    }
  }, [])

  const getRowsForSlug = useCallback(
    (slug: string): RowItem[] => {
      if ((slug === "__root__" && !categoryId) || slug === categoryId) {
        return rows
      }
      const key = slug === "__root__" ? "audioRecorderRows" : `audioRecorderRows::${slug}`
      return loadRowsFromStorage(key)
    },
    [categoryId, loadRowsFromStorage, rows],
  )

  const exportDataToJS = useCallback(() => {
    try {
      const categories = getCategories()
      const slugs = ["__root__", ...categories]
      const pages: Array<Record<string, string>> = []

      slugs.forEach((slug) => {
        const slugRows = getRowsForSlug(slug)
        if (!slugRows || slugRows.length === 0) return
        const cleanedNames = slugRows
          .map((row) => (row?.name ?? "").trim())
          .filter((name) => name.length > 0)
        if (cleanedNames.length === 0) return

        const pageNumber = String(pages.length + 1)
        const pageData: Record<string, string> = { page: pageNumber }
        cleanedNames.forEach((name, idx) => {
          pageData[`fila ${idx + 1}`] = name
        })
        pages.push(pageData)
      })

      if (pages.length === 0) return

      const fileBody = `export default ${JSON.stringify(pages, null, 2)};\n`
      const blob = new Blob([fileBody], { type: "application/javascript;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `notas-${Date.now()}.js`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      console.log("[v0] ExportaciÃ³n completada", pages.length, "pÃ¡ginas")
    } catch (error) {
      console.error("[v0] No se pudo exportar datos", error)
    }
  }, [getCategories, getRowsForSlug])

  const hasMeaningfulContent = useMemo(() => {
    if (!rows || rows.length === 0) return false
    return rows.some((row) => {
      const nameFilled = (row.name ?? "").trim().length > 0
      const linkFilled = typeof row.link === "string" && row.link.trim().length > 0
      const resources = row.resources
      const hasResources = !!resources &&
        ((resources.videos && resources.videos.length > 0) ||
          (resources.trueFalse && resources.trueFalse.length > 0) ||
          (resources.quizzes && resources.quizzes.length > 0))
      return nameFilled || linkFilled || hasResources || row.checked
    })
  }, [rows])

  // Timers para mantener abierto el menÃº del tacho durante 2s al salir con el mouse
  const rowMenuTimerRef = useRef<NodeJS.Timeout | null>(null)
  const resMenuTimerRef = useRef<NodeJS.Timeout | null>(null)

  const openRowTrashMenu = useCallback((rid: string) => {
    if (rowMenuTimerRef.current) {
      clearTimeout(rowMenuTimerRef.current)
      rowMenuTimerRef.current = null
    }
    setHoverTrashRowId(rid)
  }, [])

  const scheduleCloseRowTrashMenu = useCallback(() => {
    if (rowMenuTimerRef.current) clearTimeout(rowMenuTimerRef.current)
    rowMenuTimerRef.current = setTimeout(() => {
      setHoverTrashRowId(null)
      rowMenuTimerRef.current = null
    }, 500)
  }, [])

  const forceCloseRowTrashMenu = useCallback(() => {
    if (rowMenuTimerRef.current) {
      clearTimeout(rowMenuTimerRef.current)
      rowMenuTimerRef.current = null
    }
    setHoverTrashRowId(null)
  }, [])

  const openResTrashMenu = useCallback(
    (rowId: string, type: "videos" | "trueFalse" | "quizzes", resId: string) => {
      if (resMenuTimerRef.current) {
        clearTimeout(resMenuTimerRef.current)
        resMenuTimerRef.current = null
      }
      setHoverTrashResource({ rowId, type, resId })
    },
    [],
  )

  const scheduleCloseResTrashMenu = useCallback(() => {
    if (resMenuTimerRef.current) clearTimeout(resMenuTimerRef.current)
    resMenuTimerRef.current = setTimeout(() => {
      setHoverTrashResource(null)
      resMenuTimerRef.current = null
    }, 500)
  }, [])

  const forceCloseResTrashMenu = useCallback(() => {
    if (resMenuTimerRef.current) {
      clearTimeout(resMenuTimerRef.current)
      resMenuTimerRef.current = null
    }
    setHoverTrashResource(null)
  }, [])

  // ---- CategorÃ­as: lista, navegaciÃ³n y creaciÃ³n automÃ¡tica ----
  const CATEGORIES_KEY = "audioRecorderCategories"

  const getCategories = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(CATEGORIES_KEY)
      if (!raw) return []
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : []
    } catch {
      return []
    }
  }, [])

  const saveCategories = useCallback((list: string[]) => {
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list))
    } catch {}
  }, [])

  const ensureCategoryPresent = useCallback(
    (slug: string) => {
      if (!slug) return
      const list = getCategories()
      if (!list.includes(slug)) {
        list.push(slug)
        saveCategories(list)
      }
    },
    [getCategories, saveCategories],
  )

  const deleteCategory = useCallback(
    (slug: string) => {
      if (!slug) return
      const list = getCategories()
      const filtered = list.filter((item) => item !== slug)
      if (filtered.length !== list.length) {
        saveCategories(filtered)
      }
      try {
        localStorage.removeItem(`audioRecorderRows::${slug}`)
      } catch {}
    },
    [getCategories, saveCategories],
  )

  const cleanEmptyCategories = useCallback(() => {
    try {
      const list = getCategories()
      let changed = false
      const filtered: string[] = []
      for (const slug of list) {
        if (!slug) continue
        if (slug === categoryId) {
          filtered.push(slug)
          continue
        }
        const key = `audioRecorderRows::${slug}`
        const raw = localStorage.getItem(key)
        if (!raw) {
          localStorage.removeItem(key)
          changed = true
          continue
        }
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            filtered.push(slug)
          } else {
            localStorage.removeItem(key)
            changed = true
          }
        } catch {
          localStorage.removeItem(key)
          changed = true
        }
      }
      if (changed) {
        saveCategories(filtered)
      }
    } catch {}
  }, [categoryId, getCategories, saveCategories])

  useEffect(() => {
    if (categoryId) ensureCategoryPresent(categoryId)
  }, [categoryId, ensureCategoryPresent])

  useEffect(() => {
    cleanEmptyCategories()
  }, [cleanEmptyCategories])

  const createAndNavigateToNewCategory = useCallback(() => {
    const slug = `nota-${Date.now()}`
    const list = getCategories()
    list.push(slug)
    saveCategories(list)
    router.push(`/c/${slug}`)
  }, [getCategories, saveCategories, router])

  const navigateRelativeCategory = useCallback(
    (direction: -1 | 1) => {
      const ae = document.activeElement as HTMLElement | null
      const isInInput = !!ae && (ae?.tagName === "INPUT" || ae?.isContentEditable)
      if (isInInput || !!activeResourceModal || !!linkEditor) return

      const list = getCategories()
      if (!categoryId) {
        if (direction === -1) {
          if (list.length > 0) router.push(`/c/${list[list.length - 1]}`)
          return
        }
        if (list.length > 0) router.push(`/c/${list[0]}`)
        else if (hasMeaningfulContent) createAndNavigateToNewCategory()
        return
      }
      const idx = list.indexOf(categoryId)
      if (idx === -1) {
        ensureCategoryPresent(categoryId)
        return
      }
      const nextIndex = idx + direction
      if (nextIndex >= 0 && nextIndex < list.length) {
        if (categoryId && !hasMeaningfulContent) deleteCategory(categoryId)
        router.push(`/c/${list[nextIndex]}`)
      } else if (direction === 1 && nextIndex >= list.length) {
        if (!hasMeaningfulContent) {
          if (categoryId) deleteCategory(categoryId)
          router.push(`/`)
          return
        }
        createAndNavigateToNewCategory()
      } else if (direction === -1 && nextIndex < 0) {
        // Permite volver a la nota inicial '/'
        if (categoryId && !hasMeaningfulContent) deleteCategory(categoryId)
        router.push(`/`)
      }
    },
    [
      activeResourceModal,
      linkEditor,
      getCategories,
      router,
      categoryId,
      ensureCategoryPresent,
      createAndNavigateToNewCategory,
      hasMeaningfulContent,
      deleteCategory,
    ],
  )

  const handleCreateCategory = () => {
    const name = newCategoryName.trim() || `categoria-${Date.now()}`
    const slug = slugify(name)
    setNewCategoryOpen(false)
    try {
      router.push(`/c/${slug}`)
    } catch (e) {
      console.error("[v0] No se pudo navegar a la categorÃ­a", e)
    }
  }

  const saveToStorage = useCallback((rowsToSave: RowItem[]) => {
    try {
      const dataToSave = rowsToSave.map((row) => ({
        id: row.id,
        name: row.name,
        checked: row.checked,
        link: row.link,
        resources: {
          videos: row.resources?.videos ?? [],
          trueFalse: row.resources?.trueFalse ?? [],
          quizzes: row.resources?.quizzes ?? [],
        },
      }))
      localStorage.setItem(rowsKey, JSON.stringify(dataToSave))
      console.log("[v0] Datos guardados correctamente:", dataToSave.length, "filas")
    } catch (error) {
      console.error("[v0] Error guardando datos:", error)
    }
  }, [rowsKey])

  useEffect(() => {
    const checkExistingAccess = () => {
      const hasAccess = localStorage.getItem("directoryAccessGranted") === "true"
      if (hasAccess) {
        console.log("[v0] Acceso a carpeta ya configurado previamente")
        setHasDirectoryAccess(true)
        loadDataFromLocalStorage()
      }
    }

    checkExistingAccess()
  }, [loadDataFromLocalStorage])

  useEffect(() => {
    const focusRequest = pendingFocusRequest.current

    if (focusRequest) {
      const focusAndScroll = () => {
        const input = inputRefs.current[focusRequest.id]

        if (input) {
          input.focus()

          if (focusRequest.selectAll) {
            input.select()
          } else if (typeof focusRequest.caretPosition === "number") {
            try {
              input.setSelectionRange(focusRequest.caretPosition, focusRequest.caretPosition)
            } catch (error) {
              console.warn("[v0] No se pudo ajustar el cursor:", error)
            }
          } else {
            const end = input.value.length
            try {
              input.setSelectionRange(end, end)
            } catch (error) {
              console.warn("[v0] No se pudo posicionar el cursor al final:", error)
            }
          }

          setTimeout(() => {
            input.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            })
          }, 100)

          console.log("[v0] Input enfocado y scroll aplicado:", focusRequest.id)
          pendingFocusRequest.current = null
        } else {
          setTimeout(focusAndScroll, 20)
        }
      }

      requestAnimationFrame(() => {
        setTimeout(focusAndScroll, 50)
      })
    }
  }, [rows, editingRowId])

  // Enfoque para inputs de subrecursos en modales
  useEffect(() => {
    const req = pendingResourceFocus.current
    if (req) {
      const el = resourceInputRefs.current[req.key]
      if (el) {
        el.focus()
        if (req.selectAll) el.select()
        setTimeout(() => {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
          } catch {}
        }, 100)
        pendingResourceFocus.current = null
      } else {
        setTimeout(() => {
          const el2 = resourceInputRefs.current[req.key]
          if (el2) {
            el2.focus()
            if (req.selectAll) el2.select()
            pendingResourceFocus.current = null
          }
        }, 50)
      }
    }
  }, [rows, activeResourceModal])

  useEffect(() => {
    if (!activeResourceModal) {
      if (focusedResourceId !== null) setFocusedResourceId(null)
      return
    }
    if (activeResourceList.length === 0) {
      if (focusedResourceId !== null) setFocusedResourceId(null)
      return
    }
    const exists = focusedResourceId
      ? activeResourceList.some((item) => item.id === focusedResourceId)
      : false
    if (!exists) {
      setFocusedResourceId(activeResourceList[0].id)
    }
  }, [activeResourceModal, activeResourceList, focusedResourceId])

  useEffect(() => {
    if (!focusedResourceId) return
    const el = resourceCardRefs.current[focusedResourceId]
    if (!el) return
    try {
      if (typeof el.focus === "function") el.focus()
    } catch {}
    try {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    } catch {}
  }, [focusedResourceId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null
      const isInInput = !!activeElement && (activeElement.tagName === "INPUT" || activeElement.isContentEditable)
      const isModifier = event.ctrlKey || event.metaKey
      const key = event.key

      if ((key === "+" || key === "=") && isModifier) {
        event.preventDefault()
        adjustZoom(0.1)
        return
      }

      if ((key === "-" || key === "_") && isModifier) {
        event.preventDefault()
        adjustZoom(-0.1)
        return
      }

      if (key === "0" && isModifier) {
        event.preventDefault()
        setZoom(1)
        return
      }

      if ((key === "ArrowDown" || key === "ArrowUp") && activeResourceModal) {
        if (isInInput) return
        event.preventDefault()
        if (activeResourceList.length === 0) return
        const currentIndex = focusedResourceId
          ? activeResourceList.findIndex((item) => item.id === focusedResourceId)
          : -1
        if (key === "ArrowDown") {
          const nextIndex = currentIndex >= activeResourceList.length - 1 ? activeResourceList.length - 1 : currentIndex + 1
          setFocusedResourceId(activeResourceList[nextIndex]?.id ?? null)
        } else {
          const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1
          setFocusedResourceId(activeResourceList[nextIndex]?.id ?? null)
        }
        setEditingResource(null)
        return
      }

      if (key === "+" || key === "=") {
        event.preventDefault()
        if (activeResourceModal && hasDirectoryAccess) {
          addResourceItem(activeResourceModal.rowId, activeResourceModal.type)
        } else if (hasDirectoryAccess) {
          addRow()
        }
        return
      }

      if (key === "Enter") {
        if (activeResourceModal && !isInInput) {
          event.preventDefault()
          if (focusedResourceId) {
            pendingResourceFocus.current = {
              key: `${activeResourceModal.rowId}:${activeResourceModal.type}:${focusedResourceId}`,
              selectAll: true,
            }
            setEditingResource({
              rowId: activeResourceModal.rowId,
              type: activeResourceModal.type,
              resId: focusedResourceId,
            })
          }
        } else {
          event.preventDefault()
          if (!hasDirectoryAccess) {
            requestDirectoryAccess()
          }
        }
        return
      }

      if (key === "ArrowRight") {
        event.preventDefault()
        navigateRelativeCategory(1)
        return
      }

      if (key === "ArrowLeft") {
        event.preventDefault()
        navigateRelativeCategory(-1)
        return
      }

      if (key === "Escape") {
        // Cierra cualquier menu de tacho abierto para no bloquear la navegacion
        forceCloseRowTrashMenu()
        forceCloseResTrashMenu()
        return
      }

      if (key.toLowerCase() === "h") {
        if (!isInInput && !activeResourceModal && !linkEditor) {
          event.preventDefault()
          setArchivedOpen(true)
        }
        return
      }

      if (key.toLowerCase() === "e") {
        if (!isInInput && !activeResourceModal && !linkEditor) {
          event.preventDefault()
          exportDataToJS()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    hasDirectoryAccess,
    activeResourceModal,
    linkEditor,
    navigateRelativeCategory,
    forceCloseRowTrashMenu,
    forceCloseResTrashMenu,
    adjustZoom,
    addResourceItem,
    addRow,
    exportDataToJS,
    setZoom,
    focusedResourceId,
    setEditingResource,
    activeResourceList,
  ])
  const requestDirectoryAccess = async () => {
    console.log("[v0] Configurando acceso a carpeta local")
    localStorage.setItem("directoryAccessGranted", "true")
    setHasDirectoryAccess(true)
    loadDataFromLocalStorage()
  }

  const loadDataFromLocalStorage = () => {
    try {
      const savedRows = localStorage.getItem(rowsKey)
      if (savedRows) {
        const parsedRows = JSON.parse(savedRows)
        setRows(
          parsedRows.map((row: any) => ({
            id: row.id,
            name: row.name ?? "",
            checked: Boolean(row.checked),
            link: typeof row.link === "string" ? row.link : undefined,
            resources: {
              videos: Array.isArray(row?.resources?.videos) ? row.resources.videos : [],
              trueFalse: Array.isArray(row?.resources?.trueFalse) ? row.resources.trueFalse : [],
              quizzes: Array.isArray(row?.resources?.quizzes) ? row.resources.quizzes : [],
            },
          })),
        )
        console.log("[v0] Datos cargados desde localStorage:", parsedRows.length, "filas")
      }
    } catch (error) {
      console.error("[v0] Error cargando datos desde localStorage:", error)
    }
  }

  useEffect(() => {
    if (hasDirectoryAccess && rows.length > 0) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveToStorage(rows)
      }, 500)
    }
  }, [rows, hasDirectoryAccess, saveToStorage])

  const addRow = useCallback(() => {
    const newRowId = Date.now().toString()

    pendingFocusRequest.current = { id: newRowId, selectAll: true }
    setEditingRowId(newRowId)

    setRows((prevRows) => {
      const newRow: RowItem = {
        id: newRowId,
        name: `Fila ${prevRows.length + 1}`,
        checked: false,
        resources: { videos: [], trueFalse: [], quizzes: [] },
      }

      const updatedRows = [...prevRows, newRow]

      if (hasDirectoryAccess) {
        saveToStorage(updatedRows)
      }

      return updatedRows
    })
  }, [hasDirectoryAccess, saveToStorage])

  const openResourceModal = (
    rowId: string,
    type: "videos" | "trueFalse" | "quizzes",
  ) => {
    setActiveResourceModal({ rowId, type })
  }

  const addResourceItem = useCallback((
    rowId: string,
    type: "videos" | "trueFalse" | "quizzes",
  ) => {
    const newResId = `${Date.now()}`
    setRows((prevRows) => {
      const updated = prevRows.map((r) => {
        if (r.id !== rowId) return r
        const resources = r.resources ?? { videos: [], trueFalse: [], quizzes: [] }
        const newItem: ResourceItem = { id: newResId, name: `Recurso ${resources[type].length + 1}` }
        const next: RowItem = {
          ...r,
          resources: { ...resources, [type]: [...resources[type], newItem] },
        }
        return next
      })
      if (hasDirectoryAccess) saveToStorage(updated)
      return updated
    })
  }, [hasDirectoryAccess, saveToStorage])

  const resourceCardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  const activeResourceList = useMemo(() => {
    if (!activeResourceModal) return [] as ResourceItem[]
    const row = rows.find((r) => r.id === activeResourceModal.rowId)
    return row?.resources?.[activeResourceModal.type] ?? []
  }, [activeResourceModal, rows])

  const updateResourceName = (
    rowId: string,
    type: "videos" | "trueFalse" | "quizzes",
    resId: string,
    name: string,
  ) => {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== rowId) return r
        const resources = r.resources ?? { videos: [], trueFalse: [], quizzes: [] }
        const list = resources[type].map((it) => (it.id === resId ? { ...it, name } : it))
        return { ...r, resources: { ...resources, [type]: list } }
      })
      if (hasDirectoryAccess) saveToStorage(updated)
      return updated
    })
  }

  const handleResourceInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    rowId: string,
    type: "videos" | "trueFalse" | "quizzes",
    resId: string,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault()
      const newResId = `${Date.now()}`
      const focusKey = `${rowId}:${type}:${newResId}`
      pendingResourceFocus.current = { key: focusKey, selectAll: true }
      setEditingResource({ rowId, type, resId: newResId })
      setRows((prev) => {
        const updated = prev.map((r) => {
          if (r.id !== rowId) return r
          const resources = r.resources ?? { videos: [], trueFalse: [], quizzes: [] }
          const list = resources[type]
          const idx = list.findIndex((it) => it.id === resId)
          const newItem: ResourceItem = { id: newResId, name: "", link: undefined }
          const newList = [...list]
          if (idx >= 0) newList.splice(idx + 1, 0, newItem)
          else newList.push(newItem)
          return { ...r, resources: { ...resources, [type]: newList } }
        })
        if (hasDirectoryAccess) saveToStorage(updated)
        return updated
      })
    }
  }

  const deleteResourceItem = useCallback((
    rowId: string,
    type: "videos" | "trueFalse" | "quizzes",
    resId: string,
  ) => {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== rowId) return r
        const resources = r.resources ?? { videos: [], trueFalse: [], quizzes: [] }
        const list = resources[type].filter((it) => it.id !== resId)
        return { ...r, resources: { ...resources, [type]: list } }
      })
      if (hasDirectoryAccess) saveToStorage(updated)
      return updated
    })
  }, [hasDirectoryAccess, saveToStorage])

  const handleResourceRowClick = (
    e: React.MouseEvent,
    rowId: string,
    type: "videos" | "trueFalse" | "quizzes",
    resId: string,
  ) => {
    const target = e.target as HTMLElement
    if (target.closest("input, button, [data-interactive], svg, path")) return

    const row = rows.find((r) => r.id === rowId)
    if (!row) return
    const resList = row.resources?.[type] ?? []
    const item = resList.find((x) => x.id === resId)
    if (!item) return

    if (item.link) {
      try {
        window.open(item.link, "_blank")
      } catch (err) {
        console.error("[v0] No se pudo abrir el enlace", err)
      }
    } else {
      setLinkEditor({ value: "", target: { kind: "resource", rowId, type, resId } })
    }
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, rowId: string) => {
    if (event.key === "Enter") {
      event.preventDefault()

      const newRowId = Date.now().toString()

      pendingFocusRequest.current = { id: newRowId, caretPosition: 0 }
      setEditingRowId(newRowId)

      setRows((prevRows) => {
        const currentIndex = prevRows.findIndex((row) => row.id === rowId)
        const updatedRows = [...prevRows]
        const newRow: RowItem = {
          id: newRowId,
          name: "",
          checked: false,
          resources: { videos: [], trueFalse: [], quizzes: [] },
        }

        if (currentIndex !== -1) {
          updatedRows.splice(currentIndex + 1, 0, newRow)
        } else {
          updatedRows.push(newRow)
        }

        if (hasDirectoryAccess) {
          saveToStorage(updatedRows)
        }

        return updatedRows
      })
    }
  }

  const updateRowName = (id: string, name: string) => {
    setRows((prevRows) => prevRows.map((row) => (row.id === id ? { ...row, name } : row)))
  }

  const deleteRow = (id: string) => {
    setRows(rows.filter((row) => row.id !== id))
  }

  const toggleChecked = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)))
  }

  const handleRowClick = (e: React.MouseEvent, id: string) => {
    const target = e.target as HTMLElement
    // Ignora clics en elementos interactivos
    if (target.closest("input, button, [data-interactive], svg, path")) return

    const current = rows.find((r) => r.id === id)
    if (!current) return

    if (current.link) {
      try {
        window.open(current.link, "_blank")
      } catch (err) {
        console.error("[v0] No se pudo abrir el enlace", err)
      }
    } else {
      setLinkEditor({ value: "", target: { kind: "row", rowId: id } })
    }
  }

  return (
    <div className="space-y-4">
      {!hasDirectoryAccess ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
          <div className="text-center space-y-4">
            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Configurar Carpeta Local</h2>
              <p className="text-muted-foreground">Configura el acceso para guardar tus datos localmente</p>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4 max-w-sm">
              <p className="text-sm text-muted-foreground">
                Presiona <kbd className="bg-background px-2 py-1 rounded text-xs border">Enter</kbd> para configurar
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.filter((r) => !r.checked).map((row) => {
              const rowHasLink = typeof row.link === "string" && row.link.trim().length > 0
              return (
                <Card
                  key={row.id}
                  className="p-4 bg-card border-border cursor-pointer"
                  onClick={(e) => handleRowClick(e, row.id)}
                >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={() => toggleChecked(row.id)}
                    className="size-4 accent-primary"
                    data-interactive
                  />

                  <div className="flex-1 min-w-0">
                    {editingRowId === row.id ? (
                      <Input
                        ref={(el) => {
                          if (el) {
                            inputRefs.current[row.id] = el
                          } else {
                            delete inputRefs.current[row.id]
                          }
                        }}
                        value={row.name}
                        onChange={(e) => updateRowName(row.id, e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, row.id)}
                        onBlur={() => setEditingRowId(null)}
                        className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent text-foreground w-full"
                        placeholder="Nombre"
                        data-interactive
                      />
                    ) : (
                      <button
                        className="text-left truncate w-full text-foreground/90 hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingRowId(row.id)
                          pendingFocusRequest.current = { id: row.id, selectAll: true }
                        }}
                        data-interactive
                        aria-label="Editar nombre"
                      >
                        {row.name || "Sin nombre"}
                      </button>
                    )}
                  </div>

                  {/* se elimina informaciÃ³n redundante de enlace */}

                  <div className="ml-auto">
                  <DropdownMenu
                    open={rowHasLink && hoverTrashRowId === row.id}
                    onOpenChange={(open) =>
                      open && rowHasLink ? openRowTrashMenu(row.id) : forceCloseRowTrashMenu()
                    }
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteRow(row.id)
                          forceCloseRowTrashMenu()
                        }}
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        data-interactive
                        onMouseEnter={() => rowHasLink && openRowTrashMenu(row.id)}
                        onMouseLeave={scheduleCloseRowTrashMenu}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") {
                            if (rowHasLink) {
                              e.preventDefault()
                              e.stopPropagation()
                              setRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, link: undefined } : r)),
                              )
                              forceCloseRowTrashMenu()
                            }
                            return
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault()
                            e.stopPropagation()
                            deleteRow(row.id)
                          }
                        }}
                        aria-label="Opciones de borrado"
                        title="Borrar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    {rowHasLink ? (
                      <DropdownMenuContent
                        align="end"
                        className="w-44"
                        onMouseEnter={() => openRowTrashMenu(row.id)}
                        onMouseLeave={scheduleCloseRowTrashMenu}
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, link: undefined } : r)),
                            )
                            forceCloseRowTrashMenu()
                          }}
                        >
                          Borrar URL
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    ) : null}
                  </DropdownMenu>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 pl-8" data-interactive>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      openResourceModal(row.id, "videos")
                    }}
                    data-interactive
                    title="Videos"
                    aria-label="Videos"
                  >
                    <Video className="size-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground min-w-4 text-center">
                    {row.resources?.videos?.length ?? 0}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      openResourceModal(row.id, "trueFalse")
                    }}
                    data-interactive
                    title="Verdadero/Falso"
                    aria-label="Verdadero o Falso"
                  >
                    <CheckSquare className="size-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground min-w-4 text-center">
                    {row.resources?.trueFalse?.length ?? 0}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      openResourceModal(row.id, "quizzes")
                    }}
                    data-interactive
                    title="Cuestionarios"
                    aria-label="Cuestionarios"
                  >
                    <HelpCircle className="size-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground min-w-4 text-center">
                    {row.resources?.quizzes?.length ?? 0}
                  </span>
                </div>
                </Card>
              )
            })}
          </div>

          {rows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>
                No hay filas. Presiona <kbd className="bg-muted px-2 py-1 rounded text-xs">+</kbd> para agregar una fila.
              </p>
            </div>
          )}
        </>
      )}

      {/* Modales de recursos */}
      <Dialog open={!!activeResourceModal} onOpenChange={(open) => !open && setActiveResourceModal(null)}>
        <DialogContent className="p-0 max-h-[70vh] h-[70vh] w-[85vw] max-w-3xl overflow-hidden">
          {activeResourceModal && (
            <>
              <div className="flex flex-col h-full max-h-full">
                <div className="px-5 py-4 border-b">
                  <DialogHeader>
                    <DialogTitle>
                      {activeResourceModal.type === "videos" && "Videos"}
                      {activeResourceModal.type === "trueFalse" && "Verdadero/Falso"}
                      {activeResourceModal.type === "quizzes" && "Cuestionarios"}
                    </DialogTitle>
                    <DialogDescription>
                      {rows.find((r) => r.id === activeResourceModal.rowId)?.name || "Fila"}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="px-5 py-3 border-b flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {activeResourceList.length} recurso{activeResourceList.length === 1 ? "" : "s"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addResourceItem(activeResourceModal.rowId, activeResourceModal.type)}
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                </div>

                <div className="px-5 py-3 flex-1 overflow-y-auto space-y-1.5">
                  {activeResourceList.map((res) => {
                    const resourceHasLink = typeof res.link === "string" && res.link.trim().length > 0
                    const isFocused = focusedResourceId === res.id
                    return (
                      <Card
                        key={res.id}
                        ref={(el) => {
                          if (el) resourceCardRefs.current[res.id] = el
                          else delete resourceCardRefs.current[res.id]
                        }}
                        tabIndex={-1}
                        data-selected={isFocused ? "true" : undefined}
                        aria-selected={isFocused}
                        className={`py-2.5 px-3 bg-card border-border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors ${
                          isFocused ? "border-primary/60 ring-1 ring-primary/40 bg-card/90" : ""
                        }`}
                        onClick={(e) =>
                          handleResourceRowClick(
                            e,
                            activeResourceModal.rowId,
                            activeResourceModal.type,
                            res.id,
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-none max-w-[240px] min-w-[120px]">
                            {editingResource &&
                            editingResource.rowId === activeResourceModal.rowId &&
                            editingResource.type === activeResourceModal.type &&
                            editingResource.resId === res.id ? (
                              <Input
                                ref={(el) => {
                                  const key = `${activeResourceModal.rowId}:${activeResourceModal.type}:${res.id}`
                                  if (el) resourceInputRefs.current[key] = el
                                  else delete resourceInputRefs.current[key]
                                }}
                                value={res.name}
                                onChange={(e) =>
                                  updateResourceName(
                                    activeResourceModal.rowId,
                                    activeResourceModal.type,
                                    res.id,
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleResourceInputKeyDown(
                                    e,
                                    activeResourceModal.rowId,
                                    activeResourceModal.type,
                                    res.id,
                                  )
                                }
                                onBlur={() => setEditingResource(null)}
                                placeholder="Nombre del recurso"
                                className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent w-full"
                              />
                            ) : (
                              <button
                                className="text-left truncate w-full text-foreground/90 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingResource({
                                    rowId: activeResourceModal.rowId,
                                    type: activeResourceModal.type,
                                    resId: res.id,
                                  })
                                }}
                                aria-label="Editar nombre de recurso"
                              >
                                {res.name || "Sin nombre"}
                              </button>
                            )}
                          </div>

                          <div className="ml-auto flex items-center gap-2">
                            <DropdownMenu
                              open={
                                resourceHasLink &&
                                !!(
                                  hoverTrashResource &&
                                  activeResourceModal &&
                                  hoverTrashResource.rowId === activeResourceModal.rowId &&
                                  hoverTrashResource.type === activeResourceModal.type &&
                                  hoverTrashResource.resId === res.id
                                )
                              }
                              onOpenChange={(open) => {
                                if (!activeResourceModal) return
                                if (open && resourceHasLink) {
                                  openResTrashMenu(
                                    activeResourceModal.rowId,
                                    activeResourceModal.type,
                                    res.id,
                                  )
                                } else {
                                  forceCloseResTrashMenu()
                                }
                              }}
                            >
                              <DropdownMenuTrigger asChild>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!activeResourceModal) return
                                    deleteResourceItem(
                                      activeResourceModal.rowId,
                                      activeResourceModal.type,
                                      res.id,
                                    )
                                    forceCloseResTrashMenu()
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="text-muted-foreground hover:text-destructive"
                                  onMouseEnter={() => {
                                    if (!activeResourceModal || !resourceHasLink) return
                                    openResTrashMenu(
                                      activeResourceModal.rowId,
                                      activeResourceModal.type,
                                      res.id,
                                    )
                                  }}
                                  onMouseLeave={scheduleCloseResTrashMenu}
                                  onKeyDown={(e) => {
                                    if (!activeResourceModal) return
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (resourceHasLink) {
                                        const { rowId, type } = activeResourceModal
                                        setRows((prev) =>
                                          prev.map((r) => {
                                            if (r.id !== rowId) return r
                                            const resources = r.resources ?? { videos: [], trueFalse: [], quizzes: [] }
                                            const list = resources[type].map((it) =>
                                              it.id === res.id ? { ...it, link: undefined } : it,
                                            )
                                            return { ...r, resources: { ...resources, [type]: list } }
                                          }),
                                        )
                                        forceCloseResTrashMenu()
                                      }
                                      return
                                    }
                                    if (e.key === "ArrowUp") {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      deleteResourceItem(activeResourceModal.rowId, activeResourceModal.type, res.id)
                                    }
                                  }}
                                  aria-label="Opciones de borrado"
                                  title="Borrar"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {resourceHasLink ? (
                                <DropdownMenuContent
                                  align="end"
                                  className="w-44"
                                  onMouseEnter={() => {
                                    if (!activeResourceModal) return
                                    openResTrashMenu(
                                      activeResourceModal.rowId,
                                      activeResourceModal.type,
                                      res.id,
                                    )
                                  }}
                                  onMouseLeave={scheduleCloseResTrashMenu}
                                >
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const { rowId, type } = activeResourceModal!
                                      setRows((prev) =>
                                        prev.map((r) => {
                                          if (r.id !== rowId) return r
                                          const resources = r.resources ?? { videos: [], trueFalse: [], quizzes: [] }
                                          const list = resources[type].map((it) =>
                                            it.id === res.id ? { ...it, link: undefined } : it,
                                          )
                                          return { ...r, resources: { ...resources, [type]: list } }
                                        }),
                                      )
                                      forceCloseResTrashMenu()
                                    }}
                                  >
                                    Borrar URL
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              ) : null}
                            </DropdownMenu>
                          </div>
                        </div>
                      </Card>
                    )
                  })
                  {activeResourceList.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground select-none">
                      <p>
                        No hay recursos. Presiona
                        <kbd className="bg-muted px-2 py-1 rounded text-xs mx-1">+</kbd>
                        o usa el botÃ³n "Agregar".
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Historial de filas archivadas (tecla 'h') */}
      <Dialog open={archivedOpen} onOpenChange={setArchivedOpen}>
        <DialogContent className="max-h-[70vh] overflow-hidden p-0">
          <div className="flex flex-col max-h-[70vh]">
            <div className="p-6 border-b">
              <DialogHeader>
                <DialogTitle>Historial de filas archivadas</DialogTitle>
                <DialogDescription>Presiona restaurar para volver a la lista</DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-2">
              {rows.filter((r) => r.checked).map((row) => (
                <Card
                  key={row.id}
                  className="p-3 bg-card border-border cursor-pointer"
                  onClick={() => {
                    if (row.link) {
                      try {
                        window.open(row.link, "_blank")
                      } catch (err) {
                        console.error("[v0] No se pudo abrir el enlace", err)
                      }
                    } else {
                      setLinkEditor({ value: "", target: { kind: "row", rowId: row.id } })
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input
                        value={row.name}
                        onChange={(e) => updateRowName(row.id, e.target.value)}
                        className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                        data-interactive
                      />
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleChecked(row.id)
                      }}
                      variant="outline"
                      size="sm"
                      data-interactive
                    >
                      Restaurar
                    </Button>
                  </div>
                </Card>
              ))}
              {rows.filter((r) => r.checked).length === 0 && (
                <div className="text-center py-8 text-muted-foreground select-none">
                  No hay filas archivadas.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor de enlace propio (no prompt del navegador) */}
      <Dialog open={!!linkEditor} onOpenChange={(open) => !open && setLinkEditor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar enlace</DialogTitle>
            <DialogDescription>Pega el enlace para este elemento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              autoFocus
              placeholder="https://..."
              value={linkEditor?.value ?? ""}
              onChange={(e) =>
                setLinkEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))
              }
              className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLinkEditor(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!linkEditor) return
                  const raw = (linkEditor.value || "").trim()
                  if (!raw) return setLinkEditor(null)
                  const normalized = raw
                  if (linkEditor.target.kind === "row") {
                    const rowId = linkEditor.target.rowId
                    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, link: normalized } : r)))
                  } else {
                    const { rowId, type, resId } = linkEditor.target
                    setRows((prev) => {
                      const updated = prev.map((r) => {
                        if (r.id !== rowId) return r
                        const resources = r.resources ?? { videos: [], trueFalse: [], quizzes: [] }
                        const list = resources[type].map((it) => (it.id === resId ? { ...it, link: normalized } : it))
                        return { ...r, resources: { ...resources, [type]: list } }
                      })
                      if (hasDirectoryAccess) saveToStorage(updated)
                      return updated
                    })
                  }
                  setLinkEditor(null)
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crear nueva pÃ¡gina/categorÃ­a (ArrowRight) */}
      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva categorÃ­a/materia</DialogTitle>
            <DialogDescription>Escribe un nombre para crear una nueva pÃ¡gina</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              autoFocus
              placeholder="Nombre de la categorÃ­a"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleCreateCategory()
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewCategoryOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCategory}>Crear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}




