/************************************************************************
* MASTER/CHILD tables extension for jTable                              *
*************************************************************************/
(function ($) {

    //Reference to base object members
    var base = {
        _removeRowsFromTable: $.hik.jtable.prototype._removeRowsFromTable,
        _saveAddRecordForm: $.hik.jtable.prototype._saveAddRecordForm,
        _deleteRecordFromServer: $.hik.jtable.prototype._deleteRecordFromServer,
        _deleteButtonClickedForRow: $.hik.jtable.prototype._deleteButtonClickedForRow,
    };

    //extension members
    $.extend(true, $.hik.jtable.prototype, {

        /************************************************************************
        * DEFAULT OPTIONS / EVENTS                                              *
        *************************************************************************/
        options: {
            openChildAsAccordion: false,
            messages: {
                childTableDeleteConfirmation: "This object will be unlinked from it's parent. The record itself will not be deleted.",
            }
        },

        /************************************************************************
        * PUBLIC METHODS                                                        *
        *************************************************************************/

        /* Creates and opens a new child table for given row.
        *************************************************************************/
        openChildTable: function ($row, tableOptions, opened) {
            var self = this;

            //Apply theming as same as parent table unless explicitily set
            if (tableOptions.jqueryuiTheme == undefined) {
                tableOptions.jqueryuiTheme = self.options.jqueryuiTheme;
            }

            //Show close button as default
            tableOptions.showCloseButton = (tableOptions.showCloseButton != false);
            if (self.options.tastypie) {
                tableOptions._masterInfo = {
                    jTable: self,
                    row: $row,
                    key: tableOptions.srcColumn,
                    realDeletion: tableOptions.realDeletion,
                }
            }

            //Close child table when close button is clicked (default behavior)
            if (tableOptions.showCloseButton && !tableOptions.closeRequested) {
                tableOptions.closeRequested = function () {
                    self.closeChildTable($row);
                };
            }

            //If accordion style, close open child table (if it does exists)
            if (self.options.openChildAsAccordion) {
                $row.siblings('.jtable-data-row').each(function () {
                    self.closeChildTable($(this));
                });
            }

            //Close child table for this row and open new one for child table
            self.closeChildTable($row, function () {
                var $childRowColumn = self.getChildRow($row).children('td').empty();
                var $childTableContainer = $('<div />')
                    .addClass('jtable-child-table-container')
                    .appendTo($childRowColumn);
                $childRowColumn.data('childTable', $childTableContainer);
                $childTableContainer.jtable(tableOptions);
                self.openChildRow($row);
                $childTableContainer.hide().slideDown('fast', function () {
                    if (opened) {
                        opened({
                             childTable: $childTableContainer
                        });
                    }
                });
            });
        },

        /* Closes child table for given row.
        *************************************************************************/
        closeChildTable: function ($row, closed) {
            var self = this;

            var $childRowColumn = this.getChildRow($row).children('td');
            var $childTable = $childRowColumn.data('childTable');
            if (!$childTable) {
                if (closed) {
                    closed();
                }

                return;
            }

            $childRowColumn.data('childTable', null);
            $childTable.slideUp('fast', function () {
                $childTable.jtable('destroy');
                $childTable.remove();
                self.closeChildRow($row);
                if (closed) {
                    closed();
                }
            });
        },

        /* Returns a boolean value indicates that if a child row is open for given row.
        *************************************************************************/
        isChildRowOpen: function ($row) {
            return (this.getChildRow($row).is(':visible'));
        },

        /* Gets child row for given row, opens it if it's closed (Creates if needed).
        *************************************************************************/
        getChildRow: function ($row) {
            return $row.data('childRow') || this._createChildRow($row);
        },

        /* Creates and opens child row for given row.
        *************************************************************************/
        openChildRow: function ($row) {
            var $childRow = this.getChildRow($row);
            if (!$childRow.is(':visible')) {
                $childRow.show();
            }

            return $childRow;
        },

        /* Closes child row if it's open.
        *************************************************************************/
        closeChildRow: function ($row) {
            var $childRow = this.getChildRow($row);
            if ($childRow.is(':visible')) {
                $childRow.hide();
            }
        },

        isChildTable: function() {
            return this.options._masterInfo ? true : false;
        },

        /************************************************************************
        * OVERRIDDEN METHODS                                                     *
        *************************************************************************/

        /* Overrides _removeRowsFromTable method to remove child rows of deleted rows.
        *************************************************************************/
        _removeRowsFromTable: function ($rows, reason) {
            var self = this;

            if (reason == 'deleted') {
                $rows.each(function () {
                    var $row = $(this);
                    var $childRow = $row.data('childRow');
                    if ($childRow) {
                        self.closeChildTable($row);
                        $childRow.remove();
                    }
                });
            }

            base._removeRowsFromTable.apply(this, arguments);
        },

        _saveAddRecordForm: function ($addRecordForm, $saveButton) {
            var self = this;
            var origEvent = self.options.recordAdded;
            self.options.recordAdded = function(ev, data) {
                self.options.recordAdded = origEvent;
                var mi = self.options._masterInfo;
                var masterRecord = mi.row.data('record');
                var uri = data.record.resource_uri;

                masterRecord[mi.key].push(uri);

                self.updateRecord.call(mi.jTable, {
                    record: masterRecord,
                    animationsEnabled: false,
                });
            }
            base._saveAddRecordForm.apply(this, arguments);
        },

        _deleteRecordFromServer: function ($row, success, error, url) {
            var self = this;
            var mi = this.options._masterInfo;

            if (!this.isChildTable() || mi.realDeletion) {
                return base._deleteRecordFromServer.apply(this, arguments);
            }

            //Check if it is already being deleted right now
            if ($row.data('deleting') == true) {
                return;
            }
            $row.data('deleting', true);

            var patchData = {};
            var masterRecord = mi.row.data('record');
            var toDel = $row.data('record').resource_uri;
            var newVal = [];
            var oldVal = masterRecord[mi.key];
            for (var i = 0; i < oldVal.length; i++) {
                if (oldVal[i] != toDel) {
                    newVal.push(oldVal[i]);
                }
            }
            masterRecord[mi.key] = newVal;

            self.updateRecord.call(mi.jTable, {
                record: masterRecord,
                success: success,
                error: error,
            });
        },

        _deleteButtonClickedForRow: function ($row) {
            var self = this;
            var origMsg = self.options.messages.deleteConfirmation;
            if (!this.options._masterInfo.realDeletion) {
                self.options.messages.deleteConfirmation = self.options.messages.childTableDeleteConfirmation;
            }
            base._deleteButtonClickedForRow.apply(this, arguments);
            self.options.messages.deleteConfirmation = origMsg;
        },

        /************************************************************************
        * PRIVATE METHODS                                                       *
        *************************************************************************/

        /* Creates a child row for a row, hides and returns it.
        *************************************************************************/
        _createChildRow: function ($row) {
            var totalColumnCount = this._$table.find('thead th').length;
            var $childRow = $('<tr></tr>')
                .addClass('jtable-child-row')
                .append('<td colspan="' + totalColumnCount + '"></td>');
            $row.after($childRow);
            $row.data('childRow', $childRow);
            $childRow.hide();
            return $childRow;
        }

    });

})(jQuery);
