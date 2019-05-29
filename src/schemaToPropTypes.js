let INDENT_LEVEL = 1;
const COMPONENT_NAME_SUFFIX = 'PropTypes';
const INDENT_CHAR = '\t';

/**
 * Entry point to generate the `PropTypes`.
 * @param {Object} api - The parsed openAPI file.
 * @returns {String|Error} - The string with the whole `PropTypes` generated or an Error if it is a malformed file.
 */
const generatePropTypes = (api) => {
	const str = `import PropTypes from 'prop-types';\n\n`;
	const hasSchemas = api && 'components' in api && 'schemas' in api.components;
	const schemas = hasSchemas && api.components.schemas;

	return hasSchemas
		? Object.keys(schemas).reduce(schemasReducer(schemas), str)
		: new Error('API error: Missing schemas');
};

/**
 * Curry Reducer to stack the strings of several PropTypes. It passes the needed information in the reducer context.
 * @param {Object} schemas - The `schemas` object parsed from the openAPI file.
 * @returns {function(str: String, schemaName: String): String} - Adds up all the strings from every PropType.
 **/
const schemasReducer = schemas => (str, schemaName) => {
	const schema = schemas[schemaName];
	const componentName = formatComponentName(schemaName);
	return `${str}export const ${componentName} = {\n${ getPropTypes(schemaName, schema) }};\n\n`;
};

/**
 * Formats the component name based on React standards and a suffix to avoid name collisions.
 * @param {String} name - The key string from the schema.
 * @returns {string}
 */
const formatComponentName = name => `${name.charAt(0).toUpperCase()}${name.slice(1)}${COMPONENT_NAME_SUFFIX}`;

/**
 * Generates the string for the PropTypes of a given schema.
 * @param {String} schemaName - The key (name) of the schema.
 * @param {Object} schema - The schema to generate PropTypes from.
 * @returns {string}
 */
const getPropTypes = (schemaName, schema) => {
	const requiredProps = ('required' in schema && schema.required);
	const propTypeStringIndented = _indentDecorator(propTypeString);

	return schema.type === 'object'
		? Object.keys(schema.properties).reduce(propertiesReducer(schema.properties, requiredProps), '')
		: propTypeStringIndented([schemaName, schema, requiredProps]);
};

/**
 * Curry reducer to stack the strings for each PropTypes. It passes the needed information in the reducer context.
 * @param {Object} properties - The properties object in a schema.
 * @param {Array} requiredProps - The array of required properties in a schema.
 * @returns {function(str: String, propertyName: String): string} - The `reduce` callback function, which gets the accumulator (`str`) and the current value (`propertyName`).
 */
const propertiesReducer = (properties, requiredProps) => (str, propertyName) => {
	const propTypeStringIndented = _indentDecorator(propTypeString);
	const propType = propTypeStringIndented([propertyName, properties[propertyName], requiredProps]);

	return `${str}${propType}`;
};

/**
 * Generates the string for a given.
 * @param {String} name - The key (name) of the property.
 * @param {Object} property - The property to generate the value from.
 * @param {Array} requiredProps - The array of required properties in a schema.
 * @returns {string}
 */
const propTypeString = (name, property, requiredProps) => {
	let str = '';
	// Add quotes to property name when it contains non-words chars
	const propertyKey = !(/[^a-z]/i).test(name) ? `${name}` : `'${name}'`;

	str += `${propertyKey}: ${getPropTypeValue(name, property)}`;
	str += `${getRequired(name, property, requiredProps)}\n`;

	return str;
};

/**
 * Creates the string for the value of a property.
 * @param {String} propertyName - The key (name) of the property.
 * @param {Object} property - The property to generate the value from.
 * @returns {string}
 */
const getPropTypeValue = (propertyName, property) => {
	let str = 'PropTypes.';

	switch(property.type) {
		case 'array':
			if (property.items.$ref) {
				const extractRefProp = formatComponentName(getRef(property.items.$ref));
				str += `arrayOf(${extractRefProp})`
			} else {
				str += `arrayOf(${ getPropTypeValue(propertyName, property.items) })`;
			}
			break;

		case 'object':
			if (property.$ref) {
				str += `shape(${ getRef(property.$ref) })`;
			} else {
				INDENT_LEVEL += 1;
				str += `shape({\n${ getPropTypes(propertyName, property) }${ getIndentation(INDENT_LEVEL-1) }})`;
				INDENT_LEVEL -= 1;
			}
			break;

		case 'number':
		case 'integer':
		case 'long':
		case 'float':
		case 'double':
			str += 'number';
			break;

		case 'string':
		case 'byte':
		case 'binary':
		case 'date':
		case 'DATETIME':
		case 'password':
			str += 'string';
			break;

		case 'boolean':
			str += 'bool';
			break;

		default:
			if (property.$ref) {
				str += getPropTypeValue(propertyName, { type: 'object', ...property });
			}
			break;
	}

	return str;
};

/**
 * Decorator to add indentation to the strings output from any needed functions.
 * @param {Function} func - The function returning a string whose return needs to be decorated.
 * @param {Boolean} prefix - Whether the indentation should happen as a prefix or as a suffix. Prefix is default
 * @returns {function(args: Array): string} - The decorated String
 * @private
 */
const _indentDecorator = (func, prefix = true) => args => {
	const indents = getIndentation();

	return `${prefix ? indents : ''}${func.apply(this, args)}${prefix ? '' : indents}`;
};

/**
 * Generates the required amount of indentation.
 * @param {Number} indentLevel - The amount of indentation.
 * @returns {string} - A string with indents
 */
const getIndentation = (indentLevel = INDENT_LEVEL) => indentLevel && typeof indentLevel === 'number'
	? [...Array(Math.trunc(indentLevel))].map(() => `${INDENT_CHAR}`).join('')
	: '';

/**
 * Adds the `Required` string given a property and an array of required properties.
 * @param {String} propName - The name of the property to be checked.
 * @param {Object} property - The property itself (is property.required a valid openAPI format?).
 * @param {Array} requiredProps - The array of required properties in a schema.
 * @returns {string}
 */
const getRequired = (propName, property, requiredProps = []) => (
	Array.isArray(requiredProps) && (requiredProps.indexOf(propName) > -1 || property.required)
		? '.isRequired,'
		: ','
);

/**
 * Returns the name of the reference.
 * @param {String} ref - The `$ref` string.
 * @returns {string} - The name of the reference in the `$ref`
 */
const getRef = ref => ref.split('/').pop();

module.exports = generatePropTypes;