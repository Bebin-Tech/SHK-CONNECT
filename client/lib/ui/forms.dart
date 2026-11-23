import 'package:flutter/material.dart';

class FieldSpec {
  final String key, label, value;
  final bool secret, required;
  final List<String>? options;
  final TextInputType? keyboard;
  const FieldSpec(
    this.key,
    this.label, {
    this.value = '',
    this.secret = false,
    this.required = true,
    this.options,
    this.keyboard,
  });
}

Future<bool?> editForm(
  BuildContext context, {
  required String title,
  required List<FieldSpec> fields,
  required Future<void> Function(Map<String, String>) onSave,
}) => showDialog<bool>(
  context: context,
  barrierDismissible: false,
  builder: (_) => _EditDialog(title: title, fields: fields, onSave: onSave),
);

class _EditDialog extends StatefulWidget {
  final String title;
  final List<FieldSpec> fields;
  final Future<void> Function(Map<String, String>) onSave;
  const _EditDialog({
    required this.title,
    required this.fields,
    required this.onSave,
  });
  @override
  State<_EditDialog> createState() => _EditDialogState();
}

class _EditDialogState extends State<_EditDialog> {
  final form = GlobalKey<FormState>();
  late final controllers = {
    for (final f in widget.fields) f.key: TextEditingController(text: f.value),
  };
  bool busy = false;
  String? error;
  @override
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.onSave({
        for (final e in controllers.entries) e.key: e.value.text,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.title),
    content: SizedBox(
      width: 440,
      child: SingleChildScrollView(
        child: Form(
          key: form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final f in widget.fields)
                Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: f.options != null
                      ? DropdownButtonFormField<String>(
                          initialValue: controllers[f.key]!.text.isEmpty
                              ? f.options!.first
                              : controllers[f.key]!.text,
                          decoration: InputDecoration(labelText: f.label),
                          items: f.options!
                              .map(
                                (v) =>
                                    DropdownMenuItem(value: v, child: Text(v)),
                              )
                              .toList(),
                          onChanged: busy
                              ? null
                              : (v) => controllers[f.key]!.text = v!,
                        )
                      : TextFormField(
                          controller: controllers[f.key],
                          obscureText: f.secret,
                          enabled: !busy,
                          keyboardType: f.keyboard,
                          maxLines: f.secret
                              ? 1
                              : (f.key == 'description' ? 3 : 1),
                          decoration: InputDecoration(labelText: f.label),
                          validator: (v) =>
                              f.required && (v == null || v.trim().isEmpty)
                              ? 'Required'
                              : null,
                        ),
                ),
              if (error != null)
                Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: busy ? null : () => Navigator.pop(context, false),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: busy ? null : save,
        child: Text(busy ? 'Saving…' : 'Save'),
      ),
    ],
  );
}
