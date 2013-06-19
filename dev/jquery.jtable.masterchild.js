/************************************************************************
* MASTER/CHILD tables extension for jTable                              *
*************************************************************************/
(function ($) {

    //Reference to base object members
    var base = {
        _removeRowsFromTable: $.hik.jtable.prototype._removeRowsFromTable,
        _saveAddRecordForm: $.hik.jtable.prototype._saveAddRecordForm,
        _showAddRecordForm: $.hik.jtable.prototype._showAddRecordForm,
        _deleteRecordFromServer: $.hik.jtable.prototype._deleteRecordFromServer,
        _deleteButtonClickedForRow: $.hik.jtable.prototype._deleteButtonClickedForRow,
        _addRecordsToTable: $.hik.jtable.prototype._addRecordsToTable,
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

        // NOTE: I don't call base here if in tastypie mode; this could potentially
        //       cause problems with any new plugins.
        _addRecordsToTable: function (records) {
            var self = this;

            if (self.isChildTable() && self.options.tastypie) {
                var loadUrl = self._createRecordLoadUrl();
                var params = self._getQueryVars(loadUrl);
                var orderby = params['order_by'];
                if (orderby) {
                    var desc = orderby[0] == '-';
                    if (desc) { orderby = orderby.slice(1); }
                    records.sort(function(a, b) {
                        var order = 0;
                        if (typeof a[orderby] === 'string') {
                            if (a[orderby] < b[orderby]) order = -1;
                            if (a[orderby] > b[orderby]) order = 1;
                        } else {
                            order = a[orderby] - b[orderby];
                        }
                        return order * (desc ? -1 : 1);
                    });
                }
                if (self._filters) {
                    $.each(records, function() {
                        var record = this;
                        $.each(self._filters, function(name, filter) {
                            var match = false;
                            if (filter.type == 'options') {
                                match = $.inArray(record[name], filter.value) == -1;
                            } else if (filter.type == 'text') {
                                match = record[name].toLowerCase().indexOf(filter.value.toLowerCase()) == -1;
                            } else if (filter.type == 'daterange') {
                                //TODO: Test... probably need to parse the dates.
                                match = record[name] <= filter.value.to && record[name] >= filter.value.from;
                            } else if (filter.type == 'decimal') {
                                match = record[name] <= filter.value.to && record[name] >= filter.value.from;
                            }
                            if (match) {
                                record['_filtered_out'] = true;
                            }
                        });
                    });
                }
                $.each(records, function (index, record) {
                    if (!record._filtered_out) {
                        self._addRow(self._createRowFromRecord(record));
                    }
                });

                self._refreshRowStyles();
            } else {
                base._addRecordsToTable.apply(self, arguments);
            }
        },

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

        _showAddRecordForm: function () {
            var self = this;

            base._showAddRecordForm.apply(this, arguments);
            if (this.isChildTable()) {
                var mi = self.options._masterInfo;
                // FIXME: This is kind of hacky. It relies on the shaky assumption
                //        that the tastypie_id of the master table == the name of
                //        the reverse relation in the child.
                var masterID = mi.jTable.options.tastypie_id;
                var reverseField = $('#Edit-' + masterID, self._$addRecordDiv);
                reverseField.parents('.jtable-input-field-container').toggle(false);
            }
        },

        _saveAddRecordForm: function ($addRecordForm, $saveButton) {
            var self = this;
            var origEvent = self.options.recordAdded;
            base._saveAddRecordForm.apply(this, arguments);
            self.options.recordAdded = function(ev, data) {
                self.options.recordAdded = origEvent;
                var mi = self.options._masterInfo;
                var masterRecord = mi.row.data('record');
                var uri = data.record.resource_uri;
                var parent_uri = mi.row.data('record').resource_uri
                // FIXME: This is kind of hacky. It relies on the shaky assumption
                //        that the tastypie_id of the master table == the name of
                //        the reverse relation in the child.
                data.record[mi.jTable.options.tastypie_id] = parent_uri;

                masterRecord[mi.key].push(uri);

                self.updateRecord.call(mi.jTable, {
                    record: masterRecord,
                    animationsEnabled: false,
                });
            }
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
        },

        _getQueryVars: function(url) {
            var qsStart = url.indexOf('?');
            if (qsStart < 0) {
                return {}
            }

            var nvpair = {};
            var qs = url.slice(qsStart + 1)
            var pairs = qs.split('&');
            $.each(pairs, function(i, v){
                var pair = v.split('=');
                nvpair[pair[0]] = pair[1];
            });
            return nvpair;
        }

    });

})(jQuery);
