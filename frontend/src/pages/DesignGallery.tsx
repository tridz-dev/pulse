"use client"

import { useState } from 'react'
import { PageShell, PageHeader, SectionCard } from '@/components/shared/page-shell'
import { StatTile } from '@/components/shared/stat-tile'
import { PeriodToggle } from '@/components/shared/period-toggle'
import { FilterBar } from '@/components/shared/filter-bar'
import { ChartFrame } from '@/components/shared/chart-frame'
import { Skeleton, SkeletonRow } from '@/components/shared/skeleton'
import { ImpactStrip } from '@/components/shared/impact-strip'
import { ConsequenceRail } from '@/components/shared/consequence-rail'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Disclosure } from '@/components/ui/disclosure'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Gauge } from '@/components/ui/gauge'
import { Ledger } from '@/components/ui/ledger'
import { Meter } from '@/components/ui/meter'
import { RadioOptionCard } from '@/components/ui/radio-option-card'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { StatusChip } from '@/components/ui/status-chip'
import { StatusStrokeCard } from '@/components/ui/status-stroke-card'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from '@/components/ui/table'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toast } from '@/components/ui/toast'
import { ToggleTag } from '@/components/ui/toggle-tag'
import { TreeRow, TreeRowGroup } from '@/components/ui/tree-row'

export function DesignGallery() {
  const [periodValue, setPeriodValue] = useState<"Day" | "Week" | "Month">("Week")
  const [checkedItems, setCheckedItems] = useState({ item1: false, item2: true })
  const [selectedRadio, setSelectedRadio] = useState("option1")
  const [togglePressed, setTogglePressed] = useState(false)
  const [expandedTree, setExpandedTree] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <PageShell>
      <PageHeader
        title="Design Gallery"
        subtitle="Complete design system reference for all components"
      />

      {/* ============ SHARED COMPONENTS ============ */}

      <SectionCard title="STAT TILE">
        <div className="grid grid-cols-2 gap-6">
          <StatTile value={87} label="Compliance Score" />
          <StatTile value={null} label="No Data Example" />
          <StatTile value={45} label="With Trend Down" trend="down" trendColor="fail" />
          <StatTile value={92} label="With Trend Up" trend="up" trendColor="pass" description="Q3 improvement" />
        </div>
      </SectionCard>

      <SectionCard title="STAT TILE WITH METER">
        <div className="grid grid-cols-2 gap-6">
          <StatTile
            value={75}
            label="With Meter"
            segments={[
              { value: 75, className: "bg-pass" },
              { value: 25, className: "bg-fail" },
            ]}
          />
          <StatTile
            value={null}
            label="Null with Meter"
            segments={[
              { value: 1, className: "bg-none" },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="PERIOD TOGGLE">
        <div className="space-y-4">
          <PeriodToggle value={periodValue} onChange={setPeriodValue} />
          <p className="text-xs text-mute">Current selection: {periodValue}</p>
        </div>
      </SectionCard>

      <SectionCard title="FILTER BAR">
        <FilterBar
          filters={[
            { id: "team-a", label: "Team A" },
            { id: "status-pass", label: "Status: Pass" },
            { id: "q3-2024", label: "Q3 2024" },
          ]}
          onRemoveFilter={(id) => console.log("Remove:", id)}
          rowCountDisplay="42 rows · 3 filters"
        />
      </SectionCard>

      <SectionCard title="CHART FRAME STATES">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-mute mb-2">Ready state (with placeholder content)</p>
            <ChartFrame state="ready" minHeight="200px">
              <div className="flex items-center justify-center h-full p-8 text-mute">
                Chart content area (e.g., Recharts chart)
              </div>
            </ChartFrame>
          </div>
          <div>
            <p className="text-xs text-mute mb-2">Loading state</p>
            <ChartFrame state="loading" minHeight="200px" />
          </div>
          <div>
            <p className="text-xs text-mute mb-2">Zero data state</p>
            <ChartFrame
              state="zero"
              minHeight="200px"
              zeroMessage={{
                title: "No data available",
                description: "Start tracking to see your compliance timeline.",
              }}
            />
          </div>
          <div>
            <p className="text-xs text-mute mb-2">Filtered empty state</p>
            <ChartFrame
              state="filtered-empty"
              minHeight="200px"
              filteredEmptyMessage={{
                title: "No results",
                description: "Your filters didn't match any records. Try adjusting them.",
              }}
            />
          </div>
          <div>
            <p className="text-xs text-mute mb-2">Error state</p>
            <ChartFrame
              state="error"
              minHeight="200px"
              errorMessage={{
                title: "Couldn't load data",
                description: "We encountered an error fetching your data. Please try again.",
              }}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="SKELETON & SKELETON ROW">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-mute mb-2">Individual skeleton bars</p>
            <div className="space-y-2">
              <Skeleton height="sm" width="40%" />
              <Skeleton height="md" width="60%" />
              <Skeleton height="lg" width="80%" />
            </div>
          </div>
          <div>
            <p className="text-xs text-mute mb-2">Skeleton row (3 cells)</p>
            <SkeletonRow cellCount={3} cellWidths={[40, 30, 30]} />
          </div>
          <div>
            <p className="text-xs text-mute mb-2">Multiple skeleton rows</p>
            <div className="space-y-2">
              <SkeletonRow cellCount={3} />
              <SkeletonRow cellCount={3} />
              <SkeletonRow cellCount={3} />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="IMPACT STRIP">
        <ImpactStrip
          impactCount={23}
          impactLabel="Findings"
          deltaDisplay="+4"
          deltaLabel="This Period"
          message="Critical issues identified in compliance audit. Immediate action required for SOC 2 renewal."
        />
      </SectionCard>

      <SectionCard title="CONSEQUENCE RAIL">
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-xs text-mute mb-2">Left: Main content</p>
            <Card>
              <CardHeader>
                <CardTitle>Main Content</CardTitle>
              </CardHeader>
              <CardContent>Example card representing the main page content.</CardContent>
            </Card>
          </div>
          <ConsequenceRail
            cards={[
              {
                key: "finding-1",
                title: "SEVERITY",
                children: <p className="text-sm">Critical data access violation detected in audit logs.</p>,
              },
              {
                key: "finding-2",
                title: "IMPACT",
                children: <p className="text-sm">Affects compliance with SOC 2 Type II requirements.</p>,
              },
            ]}
            footerText="Update evidence to resolve"
            footerActions={[
              <Button key="action" variant="default" size="sm">
                Submit Fix
              </Button>,
            ]}
          />
        </div>
      </SectionCard>

      {/* ============ UI COMPONENTS ============ */}

      <SectionCard title="CARD">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description text</CardDescription>
            </CardHeader>
            <CardContent>Card content goes here.</CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Small Card</CardTitle>
            </CardHeader>
            <CardContent>Compact card size variant.</CardContent>
          </Card>
        </div>
      </SectionCard>

      <SectionCard title="BADGE">
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Default Badge</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
          <Badge variant="link">Link Badge</Badge>
        </div>
      </SectionCard>

      <SectionCard title="BUTTON">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="default">Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="xs">XS</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">✓</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="CHECKBOX ROW">
        <div className="space-y-1">
          <CheckboxRow
            checked={checkedItems.item1}
            onCheckedChange={(checked) => setCheckedItems({ ...checkedItems, item1: checked })}
            label="Item One"
          />
          <CheckboxRow
            checked={checkedItems.item2}
            onCheckedChange={(checked) => setCheckedItems({ ...checkedItems, item2: checked })}
            label="Item Two"
            secondary="12 items"
          />
        </div>
      </SectionCard>

      <SectionCard title="DIALOG">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button>Open Dialog</Button>}>
            Dialog Trigger
          </DialogTrigger>
          <DialogContent showCloseButton>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>This is a dialog example with header, content, and footer.</DialogDescription>
            </DialogHeader>
            <div className="py-4">Dialog content goes here.</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button variant="default" onClick={() => setDialogOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SectionCard>

      <SectionCard title="DISCLOSURE">
        <div className="space-y-2">
          <Disclosure title="First Disclosure" defaultOpen={true}>
            Content inside first disclosure section.
          </Disclosure>
          <Disclosure title="Second Disclosure" meta="2 items">
            Content inside second disclosure section with meta badge.
          </Disclosure>
        </div>
      </SectionCard>

      <SectionCard title="DROPDOWN MENU">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>}>
            Menu Trigger
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Action 1</DropdownMenuItem>
            <DropdownMenuItem>Action 2</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SectionCard>

      <SectionCard title="GAUGE">
        <div className="grid grid-cols-3 gap-4">
          <Gauge value={85} label="High Score" />
          <Gauge value={50} label="Medium Score" />
          <Gauge value={null} label="No Data" />
        </div>
      </SectionCard>

      <SectionCard title="LEDGER">
        <div className="grid grid-cols-3 gap-4">
          <Ledger value={92} label="Compliance Score" subtitle="Current period" />
          <Ledger value={45} label="Risk Score" subtitle="Needs attention" />
          <Ledger value={null} label="No Data" />
        </div>
      </SectionCard>

      <SectionCard title="METER">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-mute mb-2">Size: sm</p>
            <Meter
              size="sm"
              segments={[
                { value: 60, className: "bg-pass" },
                { value: 40, className: "bg-fail" },
              ]}
            />
          </div>
          <div>
            <p className="text-xs text-mute mb-2">Size: md</p>
            <Meter
              size="md"
              segments={[
                { value: 70, className: "bg-pass" },
                { value: 15, className: "bg-risk" },
                { value: 15, className: "bg-fail" },
              ]}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="RADIO OPTION CARD">
        <div className="space-y-2">
          <RadioOptionCard
            selected={selectedRadio === "option1"}
            onSelect={() => setSelectedRadio("option1")}
            title="Option 1"
            description="Description for the first option"
          />
          <RadioOptionCard
            selected={selectedRadio === "option2"}
            onSelect={() => setSelectedRadio("option2")}
            title="Option 2"
            description="Description for the second option"
          />
        </div>
      </SectionCard>

      <SectionCard title="SHEET">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<Button variant="outline">Open Sheet</Button>}>
            Sheet Trigger
          </SheetTrigger>
          <SheetContent side="right" showCloseButton>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
              <SheetDescription>Sheet description text goes here.</SheetDescription>
            </SheetHeader>
            <div className="py-4">Sheet content area.</div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Close</Button>
              <Button variant="default" onClick={() => setSheetOpen(false)}>Confirm</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </SectionCard>

      <SectionCard title="STATUS CHIP">
        <div className="flex flex-wrap gap-2">
          <StatusChip status="pass">PASS</StatusChip>
          <StatusChip status="risk">RISK</StatusChip>
          <StatusChip status="fail">FAIL</StatusChip>
          <StatusChip status="waive">WAIVE</StatusChip>
          <StatusChip status="none">NONE</StatusChip>
        </div>
      </SectionCard>

      <SectionCard title="STATUS STROKE CARD">
        <div className="space-y-2">
          <StatusStrokeCard status="pass">
            <p className="text-sm">Compliance achieved</p>
          </StatusStrokeCard>
          <StatusStrokeCard status="risk">
            <p className="text-sm">Attention required</p>
          </StatusStrokeCard>
          <StatusStrokeCard status="fail">
            <p className="text-sm">Critical issue</p>
          </StatusStrokeCard>
        </div>
      </SectionCard>

      <SectionCard title="TABLE">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Item One</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>87%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Item Two</TableCell>
              <TableCell>Pending</TableCell>
              <TableCell>62%</TableCell>
            </TableRow>
          </TableBody>
          <TableCaption>Example table with sample data</TableCaption>
        </Table>
      </SectionCard>

      <SectionCard title="TABS">
        <div className="space-y-4">
          <TabsList>
            <TabsTrigger active={true}>Tab One</TabsTrigger>
            <TabsTrigger active={false}>Tab Two</TabsTrigger>
            <TabsTrigger active={false}>Tab Three</TabsTrigger>
          </TabsList>
          <p className="text-sm text-mute">Tab one content would display here.</p>
        </div>
      </SectionCard>

      <SectionCard title="TOAST">
        <div className="space-y-2">
          <Toast variant="pass" title="Success" description="Operation completed successfully" />
          <Toast variant="risk" title="Warning" description="This action requires attention" />
          <Toast variant="fail" title="Error" description="Something went wrong" />
          <Toast variant="neutral" title="Info" description="Additional information" />
        </div>
      </SectionCard>

      <SectionCard title="TOGGLE TAG">
        <div className="flex flex-wrap gap-2">
          <ToggleTag variant="risk" pressed={togglePressed} onPressedChange={setTogglePressed}>
            {togglePressed ? "RISK (ON)" : "RISK (OFF)"}
          </ToggleTag>
          <ToggleTag variant="gate" pressed={false}>GATE (OFF)</ToggleTag>
          <ToggleTag variant="gate" pressed={true}>GATE (ON)</ToggleTag>
        </div>
      </SectionCard>

      <SectionCard title="TREE ROW & TREE ROW GROUP">
        <TreeRowGroup>
          <TreeRow
            level={0}
            name="Parent Team"
            tag="5 items"
            score={87}
            expanded={expandedTree}
            onToggle={() => setExpandedTree(!expandedTree)}
            meter={[
              { value: 87, className: "bg-pass" },
              { value: 13, className: "bg-fail" },
            ]}
          />
          {expandedTree && (
            <>
              <TreeRow
                level={1}
                name="Subteam A"
                tag="2 items"
                score={92}
                meter={[
                  { value: 92, className: "bg-pass" },
                  { value: 8, className: "bg-fail" },
                ]}
              />
              <TreeRow
                level={1}
                name="Subteam B"
                score={75}
                meter={[
                  { value: 75, className: "bg-pass" },
                  { value: 25, className: "bg-fail" },
                ]}
              />
            </>
          )}
          <TreeRow
            level={0}
            name="Another Team"
            score={null}
            expanded={false}
          />
        </TreeRowGroup>
      </SectionCard>
    </PageShell>
  )
}
