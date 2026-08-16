import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { repoRoot } from './helpers.js'

const TESTS_DIR = join(repoRoot, 'tests')

/** CONTRACT A10：A1–A9 每條在測試碼中有具名對應測試。 */
const CRITERIA = Object.freeze({
  A1: [
    'test_render_exit0_single_html',
    'test_render_body_blocks',
    'test_render_escapes_document_metadata',
    'test_render_unknown_template_is_validation_error',
    'test_render_callout_in_list_enters_block_tree',
    'test_render_prose_container_is_valid_html',
  ],
  A2: ['test_a2_embedded_ir_fields'],
  A3: ['test_a3_no_external_resource_forms', 'test_a3_forbidden_forms_match_contract_verbatim'],
  A4: [
    'test_a4_woff2_data_uri_embedded',
    'test_a4_no_tsanger_font_shipped',
    'test_a4_declared_families_are_embedded',
    'test_a4_every_needed_face_is_embedded',
    'test_a5_lint_fails_on_banned_font_string',
  ],
  A5: [
    'test_a5_lint_passes_on_rendered_artifact',
    'test_lint_json_errors',
    'test_a5_lint_clean_case_forbidden_forms_as_text',
    'test_a5_lint_clean_case_html_comment',
    'test_a5_lint_still_catches_live_markup_in_raw_island',
    'test_a5_lint_catches_live_css_in_raw_island',
    'test_a5_lint_catches_every_external_form',
    'test_a5_lint_fails_on_schema_invalid_ir',
    'test_a5_lint_fails_on_banned_font_string',
  ],
  A6: [
    'test_example_roundtrip',
    'test_a6_shell_pipe_roundtrip',
    'test_a6_pipe_survives_multiple_chunks',
    'test_a6_pipe_survives_stalling_writer',
    'test_schema_valid',
  ],
  A7: [
    'test_render_json_shape',
    'test_a7_exit_codes_classified',
    'test_a7_any_invocation_form_emits_json',
    'test_a7_explicit_help_and_version_exit_zero',
    'test_a7_usage_error_message_has_no_commander_token',
    'test_a7_no_command_message_identical_on_both_paths',
    'test_formatter_shared_both_paths',
  ],
  A8: ['test_a8_render_byte_identical'],
  A9: [
    'test_a9_five_layers_exist',
    'test_a9_cli_layer_never_imports_vue',
    'test_a9_no_source_file_exceeds_800_lines',
  ],
})

const corpus = () =>
  readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => readFileSync(join(TESTS_DIR, f), 'utf8'))
    .join('\n')

describe('A10 條文對應測試', () => {
  it('test_a10_every_criterion_has_a_named_test: A1–A9 皆有具名測試', () => {
    const text = corpus()
    const missing = []
    for (const [criterion, names] of Object.entries(CRITERIA)) {
      for (const name of names) {
        if (!text.includes(`${name}:`)) missing.push(`${criterion} → ${name}`)
      }
    }
    expect(missing).toEqual([])
  })
})
