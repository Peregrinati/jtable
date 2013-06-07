/************************************************************************
* Filtering extension for jTable
* Author: Ben Barbour
* Rev. 1.0
*************************************************************************/
(function($) {
    var base = {
        _create: $.hik.jtable.prototype._create,
        _createHeaderCellForField: $.hik.jtable.prototype._createHeaderCellForField,
    };

    $.extend(true, $.hik.jtable.prototype, {
        /************************************************************************
         * DEFAULT OPTIONS / EVENTS                                              *
         *************************************************************************/
        options: {
            filter: false,
            filter_auto: true,
        },

        /************************************************************************
         * PRIVATE FIELDS                                                        *
         *************************************************************************/
        _filters: {},

        /************************************************************************
         * OVERRIDDEN METHODS                                                     *
         *************************************************************************/

        /* Overrides _createHeaderCellForField to add filter icon.
        *************************************************************************/
        _createHeaderCellForField: function (fieldName, field) {
            var self = this;
            var headerCell = base._createHeaderCellForField.apply(this, arguments)

            if (this.options.filter && field.filter) {
                var icon = $('<span class="jtable-column-header-text jtable-filter-icon"></span>')
                    .html('&nbsp;')
                    .on('click', function(ev) {
                        self._filter_click(fieldName, field, icon);
                        ev.stopPropagation();
                    });
                headerCell.find('.jtable-column-header-container').prepend(icon);
            }

            return headerCell;
        },

        /* Overrides base method to create table filter toolbar button
         *************************************************************************/
        _create: function() {
            base._create.apply(this, arguments);
            if (this.options.filter) {
                //this._createTableFilter();
            }
        },

        /************************************************************************
         * PUBLIC METHODS                                                       *
         *************************************************************************/
        applyFilters: function() {
            var self = this;
            var f = {};
            $.each(self._filters, function(k, v) {
                var filterType = '';
                var val = null
                if (self.options.tastypie) {
                    if (v.type == 'options') {
                        filterType = '__uriIn';
                        val = v.value;
                    } else if (v.type == 'text') {
                        filterType = '__icontains';
                        val = v.value;
                    } else if (v.type == 'daterange') {
                        f[k + '__lte'] = v.value.to;
                        filterType = '__gte';
                        val = v.value.from;
                    } else {
                        val = v.value;
                    }
                }
                if (typeof val !== 'undefined') {
                    f[k + filterType] = val;
                }
            });
            self.load(f);
        },

        /************************************************************************
         * PRIVATE METHODS                                                       *
         *************************************************************************/

        _createTableFilter: function() {
            var self = this;
            var thead = this._$table.find('thead');
            self._createFilterRow()
                .appendTo(thead)
        },

        _createFilterRow: function() {
            var self = this;
            self._filterRow = $('<tr class="jtable-filter-row"></tr>');

            $.each(self._columnList, function() {
                var field = self.options.fields[this];
                self._createFilterCell(this, field)
                    .appendTo(self._filterRow);
            });

            // Empty cells for edit and delete buttons
            if (this.options.actions.updateAction != undefined || (this.options.tastypie && this.options.editable)) {
                self._createFilterCell('jtable-edit', {})
                    .appendTo(self._filterRow);
            }
            if (this.options.actions.deleteAction != undefined || (this.options.tastypie && this.options.allowDeletion)) {
                self._createFilterCell('jtable-delete', {})
                    .appendTo(self._filterRow);
            }

            return self._filterRow;
        },

        _createFilterCell: function(field_name, field) {
            var self = this;
            var filter = $('<span class="jtable-filter">F</span>')
                .data('field', {
                    name: field_name,
                    data: field,
                    jtable: self,
                })
                .on('click', self._filter_click);

            var filterCell = $('<th></th>')
                .toggle(field.visibility !== 'hidden')
                .addClass('jtable-column-header')
                .addClass('ui-state-default')
            if (field.filter) {
                filterCell.append(filter);
            }

            return filterCell;
        },

        _filter_click: function(fieldName, field, icon) {
            var self = this;
            var activatedClass = 'activated';

            var input_div = icon.data('input');
            if (!input_div) {
                input_div = self._createInputForRecordField({
                    fieldName: fieldName,
                    formType: 'filter',
                });
                icon.data('input', input_div);

                var input = $(input_div).find('input');
                if (field.options) {
                    input = $(input_div).find('select');
                    input.prop('multiple', true);
                    input.prepend('<option></option>');
                    input.css('width', '100%');
                    if ($.fn.select2) {
                        input.select2();
                        input.select2('val', null);
                    } else {
                        input.val([]);
                    }
                }

                input.prop('disabled', false);

                if (field.type == 'date') {
                    input_div.prepend('<label>From:</label><br />');
                    var end = $('<input>').datepicker();
                    end.datepicker('option', 'dateFormat', input.datepicker('option', 'dateFormat'));
                    input_div.append('<br /><label>To:</label><br />');
                    input_div.append(end);
                    input.prop('tabindex', -2);
                    end.prop('tabindex', -1);
                }
            }

            var input = $(input_div).find('input').first();
            if (field.options) {
                input = $(input_div).find('select');
            }

            $('<div></div>')
                .append(input_div)
                .dialog({
                    title: field.title + ' Filter',
                    modal: true,
                    buttons: {
                        OK: function() {
                            self._addFilter.call(self, fieldName, field, input);
                            icon.addClass(activatedClass)
                            if (self.options.filter_auto) {
                                self.applyFilters();
                            }
                            $(this).dialog("close");
                        },
                        Clear: function() {
                            self._removeFilter.call(self, fieldName)
                            icon.removeClass(activatedClass)
                            if (self.options.filter_auto) {
                                self.applyFilters();
                            }
                            $(this).dialog("close");
                        }
                    }
                });
        },

        _addFilter: function(fieldName, field, input) {
            if (field.type == 'checkbox') {
                type = 'boolean';
            }
            var type = 'text';
            var value = input.val();
            if (field.type == 'checkbox') {
                type = 'boolean';
                value = input.is(':checked');
            }
            if (field.options) {
                type = 'options';
                if ($.fn.select2) {
                    value = input.select2('val');
                    value.splice(0, 1);
                }
            }
            if (field.type == 'date') {
                type = 'daterange';
                value = {
                    from: input.val(),
                    to: input.siblings('input').val(),
                }
            }
            this._filters[fieldName] = {
                type: type,
                value: value,
            }
        },

        _removeFilter: function(fieldName) {
            delete this._filters[fieldName];
        }
    });

})(jQuery);
