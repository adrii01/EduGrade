import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Student, Assessment, Grade, Class } from '@/src/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import ExcelJS from 'exceljs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart3, CheckCircle2, GraduationCap, Search, Download, HelpCircle, Lightbulb, Target, Layers } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useTutorial } from '@/src/lib/useTutorial';
import { motion } from 'motion/react';

function GradeInput({ 
  studentId, 
  assessmentId, 
  initialValue, 
  onSave 
}: { 
  studentId: string, 
  assessmentId: string, 
  initialValue: number | undefined, 
  onSave: (val: string) => void 
}) {
  const [val, setVal] = useState(initialValue?.toString() ?? '');

  useEffect(() => {
    setVal(initialValue?.toString() ?? '');
  }, [initialValue]);

  return (
    <Input 
      type="number"
      className={`w-12 sm:w-16 h-7 sm:h-8 text-center text-[10px] sm:text-xs font-mono font-bold rounded-md border-border transition-colors ${
        val === '' ? '' : Number(val) >= 5 ? 'text-green-700 bg-green-500/10 dark:text-green-400' : 'text-red-700 bg-red-500/10 dark:text-red-400'
      }`}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== (initialValue?.toString() ?? '')) {
          onSave(val);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export default function Gradebook({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [classData, setClassData] = useState<Class | null>(null);
  const [grades, setGrades] = useState<Record<string, number>>({}); // key: studentId_assessmentId
  const [loading, setLoading] = useState(true);
  const [trimester, setTrimester] = useState('1');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { showTutorial, closeTutorial, openTutorial: setShowTutorial } = useTutorial('gradebook');

  useEffect(() => {
    const qS = query(
      collection(db, 'students'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );
    const qA = query(
      collection(db, 'assessments'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );
    const qG = query(
      collection(db, 'grades'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );

    let studentsLoaded = false;
    let assessmentsLoaded = false;
    let gradesLoaded = false;
    let classLoaded = false;

    const checkLoading = () => {
      if (studentsLoaded && assessmentsLoaded && gradesLoaded && classLoaded) {
        setLoading(false);
      }
    };

    const unsubC = onSnapshot(doc(db, 'classes', classId), (snap) => {
      if (snap.exists()) {
        setClassData({ id: snap.id, ...snap.data() } as Class);
      }
      classLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.GET, `classes/${classId}`));

    const unsubS = onSnapshot(qS, (snapS) => {
      const fetchedStudents = snapS.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      // Sort alphabetically by last name, then name
      fetchedStudents.sort((a, b) => {
        const lastNameA = (a.lastName || '').toLowerCase();
        const lastNameB = (b.lastName || '').toLowerCase();
        if (lastNameA !== lastNameB) return lastNameA.localeCompare(lastNameB);
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      setStudents(fetchedStudents);
      studentsLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'gradebook_data'));

    const unsubA = onSnapshot(qA, (snapA) => {
      setAssessments(snapA.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));
      assessmentsLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'gradebook_data'));

    const unsubG = onSnapshot(qG, (snapG) => {
      const gradeMap: Record<string, number> = {};
      snapG.docs.forEach(doc => {
        const data = doc.data() as Grade;
        gradeMap[`${data.studentId}_${data.assessmentId}`] = data.score;
      });
      setGrades(gradeMap);
      gradesLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'gradebook_data'));

    return () => {
      unsubC();
      unsubS();
      unsubA();
      unsubG();
    };
  }, [classId, teacherId]);

  const updateGrade = async (studentId: string, assessmentId: string, score: string) => {
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) return;

    const id = `${studentId}_${assessmentId}`;
    try {
      await setDoc(doc(db, 'grades', id), {
        studentId,
        assessmentId,
        classId,
        teacherId,
        score: numScore,
        updatedAt: serverTimestamp()
      });
      setGrades(prev => ({ ...prev, [id]: numScore }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    }
  };

  const filteredAssessments = React.useMemo(() => {
    let arr = assessments.filter(a => trimester !== 'all' && a.trimester === Number(trimester));
    
    // Filter out orphans (assessments that have a parentId but that parent doesn't exist)
    // Actually, we want to KEEP them but treat them as top-level if their parent is missing
    // so they are still visible and accounted for.
    arr = arr.filter(a => {
      if (!a.parentId || a.parentId === 'none') return true;
      // If it has a parent, it stays IF the parent exists OR if we want to show it as an orphan 
      // (in the table headers we show everything that's filtered).
      return true; 
    });

    if (categoryFilter === 'independent') {
      arr = arr.filter(a => {
        if (a.isCategory) return false;
        const parentId = a.parentId;
        // Independent if no parent or parent is missing from the list
        return !parentId || parentId === 'none' || !assessments.some(p => p.id === parentId);
      });
    } else if (categoryFilter !== 'all') {
      arr = arr.filter(a => {
        // Show selected category and its children
        if (a.id === categoryFilter || a.parentId === categoryFilter) return true;
        
        // Also show items that don't belong to any valid category (independent items)
        const isIndependent = !a.isCategory && (!a.parentId || a.parentId === 'none' || !assessments.some(p => p.id === a.parentId));
        return isIndependent;
      });
    }

    return arr.sort((a,b) => {
      // 1. Group by type
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      
      // 2. Identify top-level parents
      const parentA = a.parentId && a.parentId !== 'none' && assessments.some(p => p.id === a.parentId) ? a.parentId : a.id;
      const parentB = b.parentId && b.parentId !== 'none' && assessments.some(p => p.id === b.parentId) ? b.parentId : b.id;
      
      if (parentA !== parentB) {
        // They belong to different groups/independent assessments.
        // Sort by the title of their parent (or themselves if independent)
        const parentDocA = assessments.find(x => x.id === parentA) || a;
        const parentDocB = assessments.find(x => x.id === parentB) || b;
        return parentDocA.title.localeCompare(parentDocB.title);
      }
      
      // 3. They belong to the same group. Category goes first.
      if (a.isCategory && !b.isCategory) return -1;
      if (!a.isCategory && b.isCategory) return 1;
      
      // 4. Siblings -> sort by title
      return a.title.localeCompare(b.title);
    });
  }, [assessments, trimester, categoryFilter]);

  // Helper to get consistent colors for categories
  const getCategoryColor = (parentId: string | null | undefined) => {
    if (!parentId || parentId === 'none') return null;
    
    // Check for specific keywords to assign dedicated colors
    const parentDoc = assessments.find(a => a.id === parentId);
    if (parentDoc) {
      const title = parentDoc.title.toLowerCase().trim();
      if (title.includes('trabajo')) {
        return 'bg-orange-500/8 border-orange-500/20 text-orange-600';
      }
      if (title.includes('examen') || title.includes('prueb')) {
        return 'bg-purple-500/8 border-purple-500/20 text-purple-600';
      }
    }

    // Default palette for other categories
    const colors = [
      'bg-blue-500/8 border-blue-500/20 text-blue-600',
      'bg-indigo-500/8 border-indigo-500/20 text-indigo-600',
      'bg-rose-500/8 border-rose-500/20 text-rose-600',
      'bg-emerald-500/8 border-emerald-500/20 text-emerald-600',
      'bg-amber-500/8 border-amber-500/20 text-amber-600',
      'bg-cyan-500/8 border-cyan-500/20 text-cyan-600',
    ];
    
    // Get all category IDs for consistent indexing
    const categories = assessments.filter(a => a.isCategory);
    const index = categories.findIndex(c => c.id === parentId);
    
    if (index === -1) return null;
    return colors[index % colors.length];
  };

  const getCategoryTheme = (id: string, isCategory: boolean, parentId: string | null | undefined) => {
    if (isCategory) {
      const theme = getCategoryColor(id) || 'bg-primary/5 border-primary/20 text-primary';
      const colorParts = theme.split(' ');
      const textClass = colorParts[2];
      const indicatorClass = textClass.replace('text-', 'bg-');
      return {
        bg: colorParts[0], 
        border: colorParts[1].replace('/20', '/40'),
        text: textClass, 
        indicator: indicatorClass,
        accent: indicatorClass 
      };
    }
    
    if (parentId && parentId !== 'none') {
      const parentIsPresent = assessments.some(p => p.id === parentId);
      if (parentIsPresent) {
        const theme = getCategoryColor(parentId);
        if (theme) {
          const colorParts = theme.split(' ');
          const textClass = colorParts[2];
          return {
            bg: colorParts[0].replace('/8', '/3'), 
            border: colorParts[1].replace('/20', '/10'),
            text: textClass,
            indicator: textClass.replace('text-', 'bg-'),
            accent: null
          };
        }
      }
    }
    
    return {
      bg: 'bg-muted/30',
      border: 'border-border/50',
      text: 'text-foreground',
      indicator: 'bg-muted-foreground/30',
      accent: null
    };
  };

  const studentGrades = React.useMemo(() => {
    const map: Record<string, number | null> = {};

    const getScore = (studentId: string, assessmentId: string, path: string[] = []): number | null => {
      const key = `${studentId}_${assessmentId}`;
      if (map[key] !== undefined) return map[key];
      
      if (path.includes(assessmentId)) return null;

      const assessment = assessments.find(a => a.id === assessmentId);
      if (!assessment) return null;

      let score: number | null = null;
      if (assessment.isCategory) {
        const children = assessments.filter(child => child.parentId === assessment.id);
        if (children.length > 0) {
          let earned = 0;
          let hasAnyGrade = false;
          
          children.forEach(child => {
            const s = getScore(studentId, child.id, [...path, assessmentId]);
            if (s !== null) {
              earned += s * child.weight;
              hasAnyGrade = true;
            }
          });
          
          // Use the category weight as the anchor denominator
          // This way, if children sum to less than category weight, the missing parts count as 0/pending
          // If children sum to the exact category weight, it acts as a standard average
          score = hasAnyGrade ? earned / assessment.weight : null;
        }
      } else {
        score = grades[key] ?? null;
      }

      map[key] = score;
      return score;
    };

    students.forEach(s => {
      assessments.forEach(a => {
        getScore(s.id, a.id);
      });
    });

    return map;
  }, [students, assessments, grades]);

  const calculateAssessmentScore = (studentId: string, assessmentId: string): number | null => {
    return studentGrades[`${studentId}_${assessmentId}`] ?? null;
  };

  const trimesterAvgs = React.useMemo(() => {
    const map: Record<string, number | null> = {};

    [1, 2, 3].forEach(tri => {
      const list = assessments.filter(a => a.trimester === tri);
      // Top-level assessments are those with no parent, parent='none', or whose parent no longer exists
      const topLevel = list.filter(a => !a.parentId || a.parentId === 'none' || !assessments.some(p => p.id === a.parentId));

      students.forEach(s => {
        let totalWeight = 0;
        let earnedWeight = 0;
        let hasAnyGrade = false;

        topLevel.forEach(a => {
          const g = calculateAssessmentScore(s.id, a.id);
          if (g !== null) {
            earnedWeight += g * a.weight;
            hasAnyGrade = true;
          }
          totalWeight += a.weight;
        });
        
        // Trimester average: Base it on the sum of top-level weights (should ideally be 1.0 or 100%)
        map[`${s.id}_${tri}`] = (hasAnyGrade && totalWeight > 0) ? earnedWeight / totalWeight : null;
      });
    });

    return map;
  }, [students, assessments, studentGrades]);

  const calculateTrimesterAvg = (studentId: string, tri: number) => {
    return trimesterAvgs[`${studentId}_${tri}`] ?? null;
  };

  const calculateFinal = (studentId: string) => {
    if (trimester !== 'all') {
      const avg = calculateTrimesterAvg(studentId, Number(trimester));
      return avg !== null ? avg.toFixed(2) : '-';
    }

    const weights = classData?.trimesterWeights || { 1: 33.33, 2: 33.33, 3: 33.34 };
    let totalContribution = 0;
    let totalWeightUsed = 0;

    [1, 2, 3].forEach(t => {
      const triAvg = calculateTrimesterAvg(studentId, t);
      if (triAvg !== null) {
        const tWeight = (weights[t as keyof typeof weights] || 33.33) / 100;
        totalContribution += triAvg * tWeight;
        totalWeightUsed += tWeight;
      }
    });
    
    if (totalWeightUsed === 0) return '-';
    // Normalize if not all trimesters have grades yet
    return (totalContribution / totalWeightUsed).toFixed(2);
  };

  const filteredStudents = students.filter(s => 
    `${s.name} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Notas_Generales');

      // Header row
      const columns = [
        { header: 'Alumno', key: 'name', width: 35 },
      ];

      if (trimester === 'all') {
        columns.push(
          { header: '1º Trimestre', key: 't1', width: 15 },
          { header: '2º Trimestre', key: 't2', width: 15 },
          { header: '3º Trimestre', key: 't3', width: 15 },
          { header: 'Nota Final Anual', key: 'final', width: 20 }
        );
      } else {
        filteredAssessments.forEach(a => {
          columns.push({ 
            header: `${a.title} (${(a.weight * 100).toFixed(0)}%)`, 
            key: a.id, 
            width: 25 
          });
        });
        columns.push({ 
          header: `Media ${trimester}º Trim.`, 
          key: 'final', 
          width: 20 
        });
      }

      worksheet.columns = columns;

      // Style Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' } // Indigo-600
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add Data
      filteredStudents.forEach(student => {
        const studentName = student.lastName ? `${student.lastName}, ${student.name}` : student.name;
        const rowData: any = { name: studentName };

        if (trimester === 'all') {
          rowData.t1 = calculateTrimesterAvg(student.id, 1)?.toFixed(2) || '-';
          rowData.t2 = calculateTrimesterAvg(student.id, 2)?.toFixed(2) || '-';
          rowData.t3 = calculateTrimesterAvg(student.id, 3)?.toFixed(2) || '-';
          rowData.final = calculateFinal(student.id);
        } else {
          filteredAssessments.forEach(a => {
            const score = calculateAssessmentScore(student.id, a.id);
            rowData[a.id] = score !== null ? score.toFixed(2) : '-';
          });
          rowData.final = calculateFinal(student.id);
        }
        
        const row = worksheet.addRow(rowData);
        
        // Conditional coloring for final column
        const finalCell = row.getCell('final');
        const finalVal = parseFloat(finalCell.value as string);
        if (!isNaN(finalVal)) {
          finalCell.font = { bold: true, color: { argb: finalVal < 5 ? 'FFFF0000' : 'FF059669' } };
        }
      });

      // Borders for all cells
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Notas_Clase_${trimester === 'all' ? 'Anual' : trimester + 'Trim'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Archivo Excel general generado');
    } catch (error) {
      console.error(error);
      toast.error('Error al generar el archivo Excel');
    }
  };

  const exportStudentExcel = async (student: Student) => {
    try {
      const studentName = student.lastName ? `${student.lastName}, ${student.name}` : student.name;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Boletín de Notas');

      // Helper for adding styled headers
      const addStyledHeader = (text: string, rowNum: number, bgColor = 'FFF1F5F9', textColor = 'FF1E293B') => {
        const row = worksheet.getRow(rowNum);
        row.values = [text];
        worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
        row.font = { bold: true, size: 12, color: { argb: textColor } };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.alignment = { horizontal: 'center' };
      };

      // Header Section
      addStyledHeader('INFORME ACADÉMICO INDIVIDUAL', 1, 'FF4F46E5', 'FFFFFFFF');
      
      worksheet.addRow([]);
      worksheet.addRow(['ESTUDIANTE:', '', studentName.toUpperCase()]).font = { bold: true };
      worksheet.getRow(3).getCell(3).font = { bold: true, color: { argb: 'FF4F46E5' } };
      
      worksheet.addRow(['FECHA REPORTE:', '', new Date().toLocaleDateString('es-ES')]);
      worksheet.addRow([]);

      let currentRow = 6;
      addStyledHeader('DETALLE DE CALIFICACIONES POR TRIMESTRE', currentRow, 'FF6366F1', 'FFFFFFFF');
      currentRow++;

      [1, 2, 3].forEach(tri => {
        worksheet.addRow([]);
        currentRow++;
        
        const triRow = worksheet.getRow(currentRow);
        triRow.values = [`${tri}º TRIMESTRE`, '', '---'];
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        triRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        triRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        triRow.alignment = { horizontal: 'center' };
        currentRow++;

        const headerRow = worksheet.addRow(['Evaluación / Criterio', 'Peso', 'Nota']);
        headerRow.font = { bold: true, size: 10 };
        headerRow.eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          c.border = { bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } } };
        });
        currentRow++;

        // Get top-level assessments for this trimester
        const topLevel = assessments.filter(a => a.trimester === tri && !a.parentId);

        topLevel.forEach(parent => {
          const children = assessments.filter(a => a.parentId === parent.id);
          const hasChildren = children.length > 0;
          const score = calculateAssessmentScore(student.id, parent.id);
          const scoreVal = score !== null ? score.toFixed(2) : '---';

          // Add Category Row
          const r = worksheet.addRow([
            hasChildren ? `📂 ${parent.title.toUpperCase()}` : parent.title,
            `${(parent.weight * 100).toFixed(0)}%`,
            scoreVal
          ]);
          
          if (hasChildren) {
            r.font = { bold: true };
            r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            r.getCell(1).font = { bold: true, color: { argb: 'FF1E293B' } };
          }
          
          if (score !== null) {
            r.getCell(3).font = { color: { argb: score < 5 ? 'FFFF0000' : 'FF059669' }, bold: true };
          }
          currentRow++;

          // Add Sub-items
          children.forEach(child => {
            const childScore = calculateAssessmentScore(student.id, child.id);
            const childScoreVal = childScore !== null ? childScore.toFixed(2) : '---';
            const cr = worksheet.addRow([
                `      └─ ${child.title}`,
                `${(child.weight * 100).toFixed(0)}%`,
                childScoreVal
            ]);
            cr.getCell(1).font = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
            cr.getCell(2).font = { color: { argb: 'FF94A3B8' }, size: 9 };
            
            if (childScore !== null) {
                cr.getCell(3).font = { color: { argb: childScore < 5 ? 'FFFCA5A5' : 'FF6EE7B7' }, size: 9 };
            }
            currentRow++;
          });
        });
        
        const triAvg = calculateTrimesterAvg(student.id, tri);
        const avgRow = worksheet.addRow(['MEDIA TOTAL TRIMESTRE', '', triAvg !== null ? triAvg.toFixed(2) : "---"]);
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        avgRow.font = { bold: true };
        avgRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        avgRow.getCell(3).font = { bold: true, size: 12, color: { argb: 'FF4F46E5' } };
        avgRow.height = 20;
        currentRow++;
      });

      worksheet.addRow([]);
      currentRow++;
      addStyledHeader('RESUMEN FINAL ANUAL', currentRow, 'FF1E293B', 'FFFFFFFF');
      currentRow++;

      const final1 = calculateTrimesterAvg(student.id, 1)?.toFixed(2) || "---";
      const final2 = calculateTrimesterAvg(student.id, 2)?.toFixed(2) || "---";
      const final3 = calculateTrimesterAvg(student.id, 3)?.toFixed(2) || "---";
      const finalAnual = calculateFinal(student.id);

      const res1 = worksheet.addRow(['1º Trimestre', '', final1]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      currentRow++;

      const res2 = worksheet.addRow(['2º Trimestre', '', final2]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      currentRow++;

      const res3 = worksheet.addRow(['3º Trimestre', '', final3]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      currentRow++;

      const resFinal = worksheet.addRow(['CALIFICACIÓN FINAL', '', finalAnual]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      resFinal.font = { bold: true, size: 12 };
      resFinal.getCell(3).font = { bold: true, size: 14, color: { argb: parseFloat(finalAnual) < 5 ? 'FFFF0000' : 'FF059669' } };
      resFinal.height = 25;
      resFinal.alignment = { vertical: 'middle' };

      // Column Widths
      worksheet.getColumn(1).width = 40;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 15;
      worksheet.getColumn(3).alignment = { horizontal: 'center' };

      // Global Borders
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 0) {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        }
      });

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const safeName = studentName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_');
      anchor.href = url;
      anchor.download = `Reporte_${safeName}_${new Date().getFullYear()}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Boletín generado para ${student.name}`);
    } catch (error) {
      console.error(error);
      toast.error('Error al generar el reporte individual');
    }
  };

  const stats = React.useMemo(() => {
    if (students.length === 0) return null;
    
    const finalGrades = students.map(s => {
      const val = calculateFinal(s.id);
      return val === '-' ? null : parseFloat(val);
    }).filter(g => g !== null) as number[];

    if (finalGrades.length === 0) return null;

    const avg = finalGrades.reduce((a, b) => a + b, 0) / finalGrades.length;
    const passRate = (finalGrades.filter(g => g >= 5).length / finalGrades.length) * 100;
    
    const currentAssessmentIds = assessments
      .filter(a => trimester === 'all' || a.trimester === Number(trimester))
      .map(a => a.id);
    
    let maxGrade = 0;
    students.forEach(s => {
      currentAssessmentIds.forEach(aId => {
        const score = grades[`${s.id}_${aId}`];
        if (score !== undefined && score > maxGrade) {
          maxGrade = score;
        }
      });
    });
    
    return { avg, passRate, max: maxGrade };
  }, [students, assessments, trimester, trimesterAvgs, grades]);

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card/60 backdrop-blur-sm border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Media Clase</p>
                <p className="text-xl font-display font-bold text-foreground">{stats.avg.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-sm border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tasa Aprobados</p>
                <p className="text-xl font-display font-bold text-foreground">{stats.passRate.toFixed(0)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-sm border-amber-500/30 shadow-lg shadow-amber-500/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-4 flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shadow-inner shadow-amber-500/20">
                <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Mejor Puntuación</p>
                <p className="text-xl font-display font-bold text-foreground">{stats.max.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-card border-b py-4 sm:py-6 px-4 sm:px-8 gap-4">
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2">
              <CardTitle className="font-display font-bold text-xl">Cuaderno de Notas</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                onClick={() => setShowTutorial(true)}
              >
                <HelpCircle className="w-5 h-5" />
              </Button>
            </div>
            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar alumno..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-muted border-border rounded-xl focus:bg-card transition-all text-sm w-full"
              />
            </div>
          </div>
          <div className="flex gap-2 sm:gap-4 items-center w-full lg:w-auto overflow-x-auto no-scrollbar py-1">
              <Button 
                onClick={exportToExcel}
                variant="outline"
                className="rounded-full gap-2 text-xs border-primary/20 text-primary hover:bg-card hover:border-primary/40 transition-all font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                Planilla General
              </Button>
              <Label className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-bold whitespace-nowrap">Ver:</Label>
              {trimester !== 'all' && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[170px] rounded-full h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue>
                      {categoryFilter === 'all' ? 'Todas' : 
                       categoryFilter === 'independent' ? 'Sin categoría' :
                       (assessments.find(a => a.id === categoryFilter)?.title || 'Categoría')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="independent">Sin categoría</SelectItem>
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-widest opacity-50 px-2 py-1.5">Categorías</SelectLabel>
                      {assessments
                        .filter(a => a.isCategory && a.trimester === Number(trimester))
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.title}
                          </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <Select value={trimester} onValueChange={(v) => { setTrimester(v); setCategoryFilter('all'); }}>
                  <SelectTrigger className="w-full sm:w-[170px] rounded-full h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue>
                        {trimester === '1' ? '1º Trimestre' :
                         trimester === '2' ? '2º Trimestre' :
                         trimester === '3' ? '3º Trimestre' :
                         'Resumen Final'}
                      </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="1">1º Trimestre</SelectItem>
                      <SelectItem value="2">2º Trimestre</SelectItem>
                      <SelectItem value="3">3º Trimestre</SelectItem>
                      <SelectItem value="all">Resumen Final</SelectItem>
                  </SelectContent>
              </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-4 sm:px-8 font-bold border-r w-[180px] sm:w-[250px] sticky left-0 bg-muted z-20 text-xs sm:text-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Alumno</TableHead>
                  {trimester === 'all' ? (
                    <>
                      <TableHead className="text-center font-bold">1º Trim</TableHead>
                      <TableHead className="text-center font-bold">2º Trim</TableHead>
                      <TableHead className="text-center font-bold">3º Trim</TableHead>
                    </>
                  ) : (
                    filteredAssessments.map(a => {
                      const isSub = a.parentId && a.parentId !== 'none' && assessments.some(p => p.id === a.parentId);
                      const parentTitle = isSub ? assessments.find(p => p.id === a.parentId)?.title : null;
                      const theme = getCategoryTheme(a.id, a.isCategory, a.parentId);
                      
                      return (
                        <TableHead 
                          key={a.id} 
                          className={`text-center min-w-[140px] px-2 py-4 transition-all duration-200 border-r border-border/50 relative
                            ${theme.bg}
                            ${(a.parentId && a.parentId !== 'none') ? `border-l-2 ${theme.border.replace('border-', 'border-l-')}` : ''}
                          `}
                        >
                          {a.isCategory && theme.accent && (
                            <div className={`absolute top-0 left-0 right-0 h-1 ${theme.accent}`} />
                          )}
                          <div className="flex flex-col items-center gap-1.5 pt-1">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${theme.indicator}`} />
                              <span className={`text-[9px] uppercase font-black tracking-widest ${theme.text}`}>
                                {(a.weight * 100).toFixed(0)}%
                              </span>
                            </div>
                            
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold leading-snug tracking-tight break-words max-w-[130px] ${a.isCategory ? theme.text : 'text-foreground'}`}>
                                {a.title}
                              </span>
                              {isSub && (
                                <span className={`text-[8px] font-medium mt-0.5 opacity-70 italic truncate max-w-[100px] ${theme.text}`}>
                                  en {parentTitle}
                                </span>
                              )}
                              {!isSub && !a.isCategory && (
                                <span className="text-[8px] font-medium text-muted-foreground mt-0.5 opacity-40 uppercase tracking-tighter">
                                  Independiente
                                </span>
                              )}
                              {a.isCategory && (
                                <span className={`text-[8px] font-bold mt-0.5 uppercase tracking-tighter ${theme.text} opacity-80`}>
                                  Categoría
                                </span>
                              )}
                            </div>
                          </div>
                        </TableHead>
                      );
                    })
                  )}
                  <TableHead className="text-center font-bold bg-card sm:bg-card text-primary sm:sticky sm:right-0 sm:z-20 w-[80px] sm:w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    {trimester === 'all' ? 'Nota Final' : 'Media Trim.'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={trimester === 'all' ? 5 : filteredAssessments.length + 2} className="h-40 text-center text-muted-foreground italic">
                      No se encontraron alumnos.
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.map((student, index) => (
                  <motion.tr 
                    key={student.id} 
                    className="hover:bg-muted/30 transition-colors group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                  >
                    <TableCell className="px-4 sm:px-8 font-medium border-r sticky left-0 bg-card group-hover:bg-muted z-10 text-xs sm:text-sm w-[180px] sm:w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportStudentExcel(student)}
                          className="h-7 w-7 rounded-lg text-primary/80 hover:text-primary hover:bg-primary/10 shrink-0"
                          title="Descargar boletín Excel"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <span className="truncate font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                          {student.lastName ? `${student.lastName}, ${student.name}` : student.name}
                        </span>
                      </div>
                    </TableCell>
                    
                    {trimester === 'all' ? (
                      <>
                        {[1, 2, 3].map(tri => {
                          const avg = calculateTrimesterAvg(student.id, tri);
                          return (
                            <TableCell key={tri} className="text-center font-mono text-[10px] sm:text-sm border-r">
                              <span className={`px-2 py-1 rounded-md font-bold ${
                                avg === null ? 'text-muted-foreground' :
                                avg >= 5 ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
                              }`}>
                                {avg !== null ? avg.toFixed(2) : '-'}
                              </span>
                            </TableCell>
                          );
                        })}
                      </>
                    ) : (
                      filteredAssessments.map(a => {
                        const score = calculateAssessmentScore(student.id, a.id);
                        const hasChildren = assessments.some(child => child.parentId === a.id);
                        const theme = getCategoryTheme(a.id, a.isCategory, a.parentId);
                        
                        return (
                          <TableCell 
                            key={a.id} 
                            className={`p-1 sm:p-2 border-r transition-colors ${theme.bg.replace('/30', '/2').replace('/20', '/2').replace('/15', '/2').replace('/10', '/2').replace('/8', '/2')}`}
                          >
                            <div className="flex justify-center">
                              {hasChildren ? (
                                <div className="text-center flex justify-center">
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                    score === null ? 'bg-muted/30 text-muted-foreground border-transparent' :
                                    score >= 5 ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                                  }`}>
                                    {score !== null ? score.toFixed(1) : '-'}
                                  </span>
                                </div>
                              ) : (
                                <GradeInput 
                                  studentId={student.id}
                                  assessmentId={a.id}
                                  initialValue={grades[`${student.id}_${a.id}`]}
                                  onSave={(val) => updateGrade(student.id, a.id, val)}
                                />
                              )}
                            </div>
                          </TableCell>
                        );
                      })
                    )}
                    
                    <TableCell className="text-center font-bold bg-card group-hover:bg-muted sm:sticky sm:right-0 sm:z-10 w-[80px] sm:w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <Badge 
                        variant="secondary"
                        className={`border-transparent rounded-md px-1 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs ${
                          calculateFinal(student.id) === '-' ? 'bg-muted text-muted-foreground' :
                          Number(calculateFinal(student.id)) >= 5 ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 
                          'bg-red-500/10 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {calculateFinal(student.id)}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
      <Dialog open={showTutorial} onOpenChange={closeTutorial}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="p-2 bg-primary/10 rounded-xl">
                <HelpCircle className="w-6 h-6 text-primary" />
              </span>
              Guía de Notas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
              Tu cuaderno de notas recoge toda la estructura que creaste en la pestaña de evaluaciones y te permite rellenar las calificaciones.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Target className="w-5 h-5 text-blue-500" />
                  Puntuar y Editar
                </div>
                <p className="text-xs text-muted-foreground">
                  Simplemente haz click en el recuadro que corresponde a un alumno y una prueba para introducir la nota numérica sobre 10.
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Layers className="w-5 h-5 text-purple-500" />
                  Medias Automáticas
                </div>
                <p className="text-xs text-muted-foreground">
                  Al introducir notas, las columnas de categorías (y la media final del trimestre a la derecha) se calcularán solas usando los pesos que definiste en la configuración.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3">
              <Lightbulb className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-1 text-primary">Filtrado rápido y Excel</h4>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>Puedes filtrar la vista por trimestres para evitar ver columnas vacías, y puedes descargar el informe en un archivo Excel compatible usando el botón "Planilla General".</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full sm:w-auto" onClick={closeTutorial}>¡Entendido!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
