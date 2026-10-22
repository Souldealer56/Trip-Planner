import React from 'react'
import { OptionPitchModal } from '../OptionPitchModal'
import { AddExpenseModal } from '../modals/AddExpenseModal'
import { EditTripModal } from '../modals/EditTripModal'
import { PrintableItineraryModal, PollRecapModal } from '../modals/PrintableItineraryModal'
import { ActivityFeedDrawer } from './ActivityFeedDrawer'

/**
 * TripModalsContainer sub-component orchestrating all modal dialogs and slideout drawers
 * for the TripDetails view.
 */
export function TripModalsContainer({
  // Optional tripManagement bundle
  tripManagement = null,

  // Pitch / Edit Option Modal Props
  showPitchModal,
  onClosePitchModal,
  onPitchSubmit,
  pitchLoading,
  pitchError,
  categories,
  pitchInitialCategory,
  pitchInitialDates,
  baseCurrency,
  roster,
  activeUser,
  editingOption,
  trip,

  // Add / Edit Expense Modal Props
  showExpenseModal,
  onCloseExpenseModal,
  onExpenseSubmit,
  expenseLoading,
  expenseError,
  expenseOptionToPreFill,
  expenseToEdit,

  // Edit Trip & Settings Modal Props
  showEditTripModal = tripManagement?.showEditTripModal,
  onCloseEditTripModal = tripManagement ? () => {
    tripManagement.setShowEditTripModal(false)
    tripManagement.setEditingTripSnapshot(null)
  } : undefined,
  editingTripSnapshot = tripManagement?.editingTripSnapshot,
  onEditTripSubmit = tripManagement?.handleEditTripSubmit,
  editLoading = tripManagement?.editLoading,
  editError = tripManagement?.editError,
  onToggleArchive = tripManagement?.handleToggleArchive,
  onOpenDeleteConfirm = tripManagement ? () => tripManagement.setShowDeleteConfirm(true) : undefined,
  showDeleteConfirm = tripManagement?.showDeleteConfirm,
  onCloseDeleteConfirm = tripManagement ? () => tripManagement.setShowDeleteConfirm(false) : undefined,
  onConfirmDelete = tripManagement?.handleConfirmDelete,
  deleteLoading = tripManagement?.deleteLoading,
  deleteError = tripManagement?.deleteError,
  conflictingOptions = tripManagement?.conflictingOptions,
  showReconcileModal = tripManagement?.showReconcileModal,
  onCloseReconcileModal = tripManagement ? () => tripManagement.setShowReconcileModal(false) : undefined,

  // Printable Itinerary Modal Props
  showPrintableItineraryModal = tripManagement?.showPrintableItineraryModal,
  onClosePrintableItineraryModal = tripManagement ? () => tripManagement.setShowPrintableItineraryModal(false) : undefined,
  printableOptions,

  // Poll Recap Modal Props
  showPollRecapModal = tripManagement?.showPollRecapModal,
  onClosePollRecapModal = tripManagement ? () => tripManagement.setShowPollRecapModal(false) : undefined,
  activeTab,
  options,
  activePoll,

  // Activity Feed Drawer Props
  showActivityDrawer = tripManagement?.showActivityDrawer,
  onCloseActivityDrawer = tripManagement ? () => tripManagement.setShowActivityDrawer(false) : undefined,
  activityLogs = tripManagement?.activityLogs,
  lastReadTimestamp = tripManagement?.lastReadTimestamp
}) {
  return (
    <>
      <OptionPitchModal
        isOpen={showPitchModal}
        onClose={onClosePitchModal}
        onSubmit={onPitchSubmit}
        loading={pitchLoading}
        error={pitchError}
        categories={categories}
        initialCategory={pitchInitialCategory}
        initialStartDate={pitchInitialDates?.start}
        initialEndDate={pitchInitialDates?.end}
        baseCurrency={baseCurrency}
        roster={roster}
        activeUserId={activeUser?.id}
        editingOption={editingOption}
        trip={trip}
      />

      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={onCloseExpenseModal}
        onSubmit={onExpenseSubmit}
        loading={expenseLoading}
        error={expenseError}
        roster={roster}
        baseCurrency={baseCurrency}
        activeUserId={activeUser?.id}
        optionToPreFill={expenseOptionToPreFill}
        expenseToEdit={expenseToEdit}
      />

      <EditTripModal
        isOpen={showEditTripModal}
        onClose={onCloseEditTripModal}
        trip={editingTripSnapshot || trip}
        onSubmit={onEditTripSubmit}
        loading={editLoading}
        error={editError}
        onToggleArchive={onToggleArchive}
        onOpenDeleteConfirm={onOpenDeleteConfirm}
        showDeleteConfirm={showDeleteConfirm}
        onCloseDeleteConfirm={onCloseDeleteConfirm}
        onConfirmDelete={onConfirmDelete}
        deleteLoading={deleteLoading}
        deleteError={deleteError}
        conflictingOptions={conflictingOptions}
        showReconcileModal={showReconcileModal}
        onCloseReconcileModal={onCloseReconcileModal}
      />

      <PrintableItineraryModal
        isOpen={showPrintableItineraryModal}
        onClose={onClosePrintableItineraryModal}
        trip={trip}
        options={printableOptions}
      />

      <PollRecapModal
        isOpen={showPollRecapModal}
        onClose={onClosePollRecapModal}
        activeTab={activeTab}
        options={options}
        activePoll={activePoll}
        roster={roster}
      />

      <ActivityFeedDrawer
        isOpen={showActivityDrawer}
        onClose={onCloseActivityDrawer}
        activityLogs={activityLogs}
        lastReadTimestamp={lastReadTimestamp}
      />
    </>
  )
}
